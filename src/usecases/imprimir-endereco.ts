import * as XLSX from "xlsx";
import { config } from "../config";
import { ENDERECO_COD_ITEM, ENDERECO_CODE } from "../constants";
import { db } from "../db";
import { TipoComissionador, TipoMap } from "../enum";
import { enviarParaImpressora } from "../impressora";
import { atualizaEndereco } from "./atualizar-base";

// carrega o mapa name -> code de uma org+type
function carregarMapa(org: number, type: string): Map<string, number> {
  const rows = db
    .query<{ name: string; code: number }, [number, string]>(
      "SELECT name, code FROM tb_map WHERE org = ? AND type = ?",
    )
    .all(org, type);
  return new Map(rows.map((r) => [r.name, r.code]));
}

// valores da coluna "Selecionar" (A) que representam SIM
const SIM = new Set(["x", "s", "1", "sim"]);

const isSim = (v: unknown): boolean =>
  SIM.has(
    String(v ?? "")
      .trim()
      .toLowerCase(),
  );

// escapa valor para CSV (aspas se tiver virgula/aspas/quebra de linha)
function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// Usecase: imprimir etiquetas de endereco (posicao no deposito).
//
// Diferente de serie/lote, o endereco nao tem item nem quantidade: o EPC e
// montado so a partir do sequencial do bincode, e sai uma etiqueta por
// endereco distinto entre as linhas marcadas.
export async function imprimirEnderecos(): Promise<void> {
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

  // le como matriz de linhas; primeira linha e cabecalho
  const linhas1 = XLSX.utils.sheet_to_json<unknown[]>(ws1, { header: 1 });

  // linhas marcadas na coluna A (indice 0), bincode na coluna B (indice 1).
  // o Set colapsa o endereco repetido: uma etiqueta por posicao, nao por linha.
  const bincodes = [
    ...new Set(
      linhas1
        .slice(1)
        .filter((linha) => isSim(linha[0]))
        .map((linha) => String(linha[1] ?? "").trim())
        .filter((b) => !!b),
    ),
  ];

  if (bincodes.length === 0) {
    return;
  }

  // garante que todo bincode tem sequencial no tb_map antes de montar o EPC
  await atualizaEndereco(bincodes);

  const org = Number(config.orgName);
  const mapaEndereco = carregarMapa(org, TipoMap.ENDERECO);

  // EPC (24 digitos):
  //   ORG(4) + COD_ITEM(6) + TIPO(1) + SEQUENCIAL(5) + "000"(3) + CODE(5)
  // COD_ITEM e CODE sao fixos para endereco; so o sequencial varia.
  const etiquetas = bincodes.map((BINCODE) => {
    const sequencial = mapaEndereco.get(BINCODE);

    if (sequencial === undefined) {
      throw new Error(`Endereco sem sequencial no tb_map: ${BINCODE}`);
    }

    const prefix =
      `${config.orgName.padStart(4, "0")}` +
      `${ENDERECO_COD_ITEM}` +
      `${TipoComissionador.ENDERECO}` +
      `${String(sequencial).padStart(5, "0")}` +
      `000`;

    return {
      BINCODE,
      prefix,
      EPC: `${prefix}${String(ENDERECO_CODE).padStart(5, "0")}`,
    };
  });

  // registra os RFID. O unique (org, prefix, code) faz a reimpressao do mesmo
  // endereco cair no IGNORE, entao o EPC nao muda entre impressoes.
  const insert = db.prepare(
    "INSERT OR IGNORE INTO tb_rfid (org, code, type, prefix, extras) VALUES (?, ?, ?, ?, ?)",
  );

  const tx = db.transaction(() => {
    for (const e of etiquetas) {
      insert.run(
        org,
        ENDERECO_CODE,
        TipoComissionador.ENDERECO,
        e.prefix,
        JSON.stringify({ BINCODE: e.BINCODE }),
      );
    }
  });
  tx();

  await enviarParaImpressora(etiquetas, TipoComissionador.ENDERECO);

  // exporta todo o tb_rfid para CSV
  const todos = db
    .query<
      {
        id: number;
        org: number;
        code: number;
        type: number;
        prefix: string;
        extras: string;
      },
      []
    >("SELECT id, org, code, type, prefix, extras FROM tb_rfid ORDER BY id")
    .all();

  const csv = [
    "id,org,code,type,prefix,extras",
    ...todos.map(
      (r) =>
        `${r.id},${r.org},${r.code},${r.type},${csvCell(r.prefix)},${csvCell(r.extras)}`,
    ),
  ].join("\n");

  await Bun.write("dados/tb_rfid_map.csv", csv);
}
