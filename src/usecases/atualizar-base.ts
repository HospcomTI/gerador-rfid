import * as XLSX from "xlsx";
import { config } from "../config";
import { SEPARATOR } from "../constants";
import { TipoMap } from "../enum";
import { db } from "../db";

// item da base ja com a validade da aba 2 juntada
export type ItemBase = {
  itemCode: string;
  descricao: string;
  serieCode: string;
  loteCode: string;
  quantidade: string;
  validade: string;
};

// escapa valor para CSV (aspas se tiver virgula/aspas/quebra de linha)
function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// Mapeia em massa nomes no tb_map para uma org + type.
// Cada name distinto ganha um code numerico sequencial (unico por org+type).
// Novos codes comecam em MAX(code)+1; nomes ja mapeados sao ignorados.
// Ao final exporta todos os nomes da org+type para o CSV informado.
async function mapearEmMassa(
  type: string,
  nomes: string[],
  csvPath: string,
): Promise<void> {
  const org = Number(config.orgName);
  const unicos = [...new Set(nomes)];
  if (unicos.length === 0) {
    return;
  }

  // carrega o mapa atual da org+type de uma vez (evita SELECT por linha)
  const jaExistem = new Set(
    db
      .query<{ name: string }, [number, string]>(
        "SELECT name FROM tb_map WHERE org = ? AND type = ?",
      )
      .all(org, type)
      .map((r) => r.name),
  );

  // maior code atual da org+type -> proximo code livre
  const maxRow = db
    .query<{ max: number | null }, [number, string]>(
      "SELECT MAX(code) AS max FROM tb_map WHERE org = ? AND type = ?",
    )
    .get(org, type);
  let proximo = (maxRow?.max ?? 0) + 1;

  const insert = db.prepare(
    "INSERT OR IGNORE INTO tb_map (org, code, type, name) VALUES (?, ?, ?, ?)",
  );

  // insercao em massa em um unico transaction
  const tx = db.transaction(() => {
    for (const name of unicos) {
      if (jaExistem.has(name)) {
        continue;
      }
      insert.run(org, proximo, type, name);
      jaExistem.add(name);
      proximo++;
    }
  });

  tx();

  // exporta o mapa da org+type para CSV
  const rows = db
    .query<
      { org: number; code: number; type: string; name: string },
      [number, string]
    >(
      "SELECT org, code, type, name FROM tb_map WHERE org = ? AND type = ? ORDER BY code",
    )
    .all(org, type);

  const csv = [
    "org,code,type,name",
    ...rows.map((r) => `${r.org},${r.code},${r.type},${csvCell(r.name)}`),
  ].join("\n");

  await Bun.write(csvPath, csv);
}

// Mapeia em massa os lotes no tb_map.
export async function atualizaLote(itens: ItemBase[]): Promise<void> {
  const nomes = itens
    .filter((i) => !!i.loteCode)
    .map((i) => `${i.itemCode}${SEPARATOR}${i.loteCode}`);

  await mapearEmMassa(TipoMap.LOTE, nomes, "dados/tb_lote_map.csv");
}

// Mapeia em massa os itens no tb_map.
export async function atualizaItem(itens: ItemBase[]): Promise<void> {
  const nomes = itens.filter((i) => !!i.itemCode).map((i) => `${i.itemCode}`);

  await mapearEmMassa(TipoMap.ITEM, nomes, "dados/tb_item_map.csv");
}

// Mapeia em massa as series no tb_map.
export async function atualizaSerie(itens: ItemBase[]): Promise<void> {
  const nomes = itens
    .filter((i) => !!i.serieCode)
    .map((i) => `${i.itemCode}${SEPARATOR}${i.serieCode}`);

  await mapearEmMassa(TipoMap.SERIE, nomes, "dados/tb_serie_map.csv");
}
// Mapeia em massa os enderecos (posicao no deposito) no tb_map.
// Cada bincode distinto ganha o sequencial que vai no EPC da etiqueta.
export async function atualizaEndereco(bincodes: string[]): Promise<void> {
  const nomes = bincodes.filter((b) => !!b);

  await mapearEmMassa(TipoMap.ENDERECO, nomes, "dados/tb_endereco_map.csv");
}

// Usecase: atualizar a base a partir do XLSX.
// Le todos os dados da aba 1 e da aba 2.
export async function atualizarBase(): Promise<void> {
  // le o xlsx do caminho definido no .env
  const buf = await Bun.file(config.xlsxPath).arrayBuffer();

  // cellStyles: true e obrigatorio para o SheetJS popular ws["!rows"]
  // (sem isso, nenhuma linha vem marcada como hidden e o filtro e ignorado)
  const wb = XLSX.read(new Uint8Array(buf), {
    type: "array",
    cellStyles: true,
  });

  // aba 1
  const ws1 = wb.Sheets[config.sheet1];
  if (!ws1) {
    throw new Error(`Aba nao encontrada no XLSX: ${config.sheet1}`);
  }

  // aba 2
  const ws2 = wb.Sheets[config.sheet2];
  if (!ws2) {
    throw new Error(`Aba nao encontrada no XLSX: ${config.sheet2}`);
  }

  // le como matriz de linhas; primeira linha e cabecalho
  const linhas1 = XLSX.utils.sheet_to_json<unknown[]>(ws1, { header: 1 });
  const linhas2 = XLSX.utils.sheet_to_json<unknown[]>(ws2, { header: 1 });

  // normaliza valor para uso como chave de join
  const chave = (item: unknown, lote: unknown): string =>
    `${String(item ?? "").trim()}${SEPARATOR}${String(lote ?? "").trim()}`;

  // indexa aba 2 por (Cod.Item A + N°Lote O) -> Validade (P)
  // A=0, O=14, P=15
  const validadePorChave = new Map<string, unknown>();
  for (const linha of linhas2.slice(1)) {
    validadePorChave.set(chave(linha[0], linha[14]), linha[15]);
  }

  // junta aba 1 com validade da aba 2
  // aba 1: C=2 (Nº item), D=3 (Descricao), E=4 (Nº serie),
  //        H=7 (Nº lote), I=8 (Quantidade)
  const base = linhas1
    .slice(1)
    .map((linha) => ({
      itemCode: linha[2],
      descricao: linha[3],
      serieCode: linha[4],
      loteCode: linha[7],
      quantidade: linha[8],
      validade: validadePorChave.get(chave(linha[2], linha[7])),
    }))
    .filter((l) => !!l.serieCode || !!l.loteCode) as ItemBase[];

  // aba 1: B=1 (Posicao no deposito). Fica fora do `base` porque o endereco
  // existe mesmo em linha sem serie/lote.
  const enderecos = linhas1
    .slice(1)
    .map((linha) => String(linha[1] ?? "").trim())
    .filter((b) => !!b);

  await atualizaEndereco(enderecos);
  await atualizaItem(base);
  await atualizaSerie(base);
  await atualizaLote(base);
}
