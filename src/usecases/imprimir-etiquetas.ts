import * as XLSX from "xlsx";
import { config } from "../config";
import { MODEL_LOTE, MODEL_SERIE, SEPARATOR } from "../constants";
import { db } from "../db";
import { TipoComissionador, TipoMap } from "../enum";
import type { ItemBase } from "./atualizar-base";

// carrega o mapa name -> code de uma org+type
function carregarMapa(org: number, type: string): Map<string, number> {
  const rows = db
    .query<
      { name: string; code: number },
      [number, string]
    >("SELECT name, code FROM tb_map WHERE org = ? AND type = ?")
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

// normaliza valor para uso como chave de join
const chave = (item: unknown, lote: unknown): string =>
  `${String(item ?? "").trim()}${SEPARATOR}${String(lote ?? "").trim()}`;

// Usecase: imprimir etiquetas de um tipo (1 serie / 2 lote).
export async function imprimirEtiquetas(
  tipo: TipoComissionador,
): Promise<void> {
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

  // filtra linhas de dados onde coluna A (indice 0) representa SIM
  const selecionadas = linhas1.slice(1).filter((linha) => isSim(linha[0]));

  // indexa aba 2 por (Cod.Item A + N°Lote O) -> Validade (P)
  // A=0, O=14, P=15
  const validadePorChave = new Map<string, unknown>();
  for (const linha of linhas2.slice(1)) {
    validadePorChave.set(chave(linha[0], linha[14]), linha[15]);
  }
console.log('selecionadas', selecionadas)
  // junta aba 1 com validade da aba 2
  // aba 1: C=2 (Nº item), D=3 (Descricao), E=4 (Nº serie),
  //        H=7 (Nº lote), I=8 (Quantidade)
  const base = selecionadas
    .map((linha) => {
      const serieCode = linha[4];
      const loteCode = linha[7];

      let tipo = 0;

      if (!!loteCode) {
        tipo = TipoComissionador.LOTE;
      }

      if (!!serieCode) {
        tipo = TipoComissionador.SERIE;
      }

      let validade = validadePorChave.get(chave(linha[2], linha[7]))

      // pode vir como serial do Excel (ex: "43985" = dias desde 30/12/1899)
      if (validade && /^\d+(\.\d+)?$/.test(String(validade).trim())) {
        const d = XLSX.SSF.parse_date_code(Number(String(validade).trim()));
        validade = `${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}/${d.y}`;
      } else if (validade) {
        // pode vir como "2026-12-15 00:00:00.000" (ou Date) ou ja como "15/12/2026"
        const data =
          validade instanceof Date
            ? validade.toISOString().slice(0, 10)
            : String(validade).trim().slice(0, 10);

        if (data.includes("-")) {
          // formato americano yyyy-mm-dd -> dd/mm/yyyy
          const [ano, mes, dia] = data.split("-");
          validade = `${dia}/${mes}/${ano}`;
        } else {
          // ja esta em dd/mm/yyyy
          validade = data;
        }
      }

      return {
        tipo,
        itemCode: linha[2],
        descricao: linha[3],
        serieCode,
        loteCode,
        quantidade: linha[8],
        validade,
      };
    })
    .filter((l) => l.tipo === tipo) as (ItemBase & { tipo: number })[];

  // gera o arquivo XLSX_OUT_PATH.
  // COLUNAS: DE CODIGO, CODIGO, TIPO, DE LOTE, LOTE, QUANTIDADE, DESCRICAO, VALIDADE
  //
  // DE CODIGO = code do tb_item_map (itemCode) + sufixo EPC
  // CODIGO    = itemCode
  // TIPO 1 (serie): DE LOTE/LOTE carregam a serie (tb_serie_map / serieCode); sem validade
  // TIPO 2 (lote):  DE LOTE/LOTE carregam o lote  (tb_lote_map  / loteCode);  pode ter validade
  const org = Number(config.orgName);
  const mapaItem = carregarMapa(org, TipoMap.ITEM);
  const mapaSerie = carregarMapa(org, TipoMap.SERIE);
  const mapaLote = carregarMapa(org, TipoMap.LOTE);

  const linhas = base.map((i) => {
    const serie = i.tipo === TipoComissionador.SERIE;

    const TIPO = i.tipo;

    const COD_ITEM = String(mapaItem.get(String(i.itemCode)));

    const COD_LOTE = serie
      ? undefined
      : mapaLote.get(`${i.itemCode}${SEPARATOR}${i.loteCode}`);

    const COD_SERIE = serie
      ? mapaSerie.get(`${i.itemCode}${SEPARATOR}${i.serieCode}`)
      : undefined;

    const SERIE_LOTE = String(COD_LOTE || COD_SERIE || "");

    return {
      TIPO,
      COD_ITEM,
      CODIGO: i.itemCode,
      COD_LOTE,
      LOTE: serie ? undefined : i.loteCode,
      COD_SERIE,
      SERIE: serie ? i.serieCode : undefined,
      QTD: i.quantidade,
      DESCRICAO: i.descricao,
      VALIDADE: serie ? '' : (i.validade ?? ''),
      RFID_PREFIX: `${config.orgName.padStart(4, "0")}${COD_ITEM.padStart(6, "0")}${TIPO}${SERIE_LOTE.padStart(5, "0")}000`,
    };
  });

  // repete cada linha conforme a QTD: uma etiqueta por unidade (QTD 3 -> 3 linhas)
  const linhasExpandidas = linhas.flatMap((l) => {
    const qtd = Math.max(1, Math.trunc(Number(l.QTD)) || 1);
    return Array.from({ length: qtd }, () => ({ ...l, QTD: 1 }));
  });

  // cria os RFID na tb_rfid. Contador de code e por prefix (novo prefix -> 1).
  // SERIE: reusa o code existente do prefix (nao cria outro).
  // LOTE:  incrementa a partir do maior code daquele prefix.
  // prefix ja embute o TIPO, entao MAX(code) por prefix = code da serie ou topo do lote.
  const maxPorPrefix = new Map(
    db
      .query<{ prefix: string; max: number }, [number]>(
        "SELECT prefix, MAX(code) AS max FROM tb_rfid WHERE org = ? GROUP BY prefix",
      )
      .all(org)
      .map((r) => [r.prefix, r.max] as const),
  );

  const insert = db.prepare(
    "INSERT INTO tb_rfid (org, code, type, prefix, extras) VALUES (?, ?, ?, ?, ?)",
  );

  const rfids: ((typeof linhasExpandidas)[number] & { EPC: string })[] = [];
  const tx = db.transaction(() => {
    for (const l of linhasExpandidas) {
      const prefix = l.RFID_PREFIX;
      const existente = maxPorPrefix.get(prefix);
      let code: number;

      if (tipo === TipoComissionador.SERIE && existente !== undefined) {
        code = existente; // reusa, nao insere
      } else {
        code = (existente ?? 0) + 1; // prefix novo comeca em 1
        const { QTD, ...extras } = l; // extras nao guarda a quantidade
        insert.run(org, code, tipo, prefix, JSON.stringify(extras));
        maxPorPrefix.set(prefix, code);
      }

      rfids.push({ ...l, EPC: `${prefix}${String(code).padStart(5, "0")}` });
    }
  });
  tx();

  await enviarParaImpressora(rfids, tipo);

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

// escapa valor para CSV (aspas se tiver virgula/aspas/quebra de linha)
function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// Envia as etiquetas (termica + RFID) para a impressora Zebra via ZPL (TCP 9100).
async function enviarParaImpressora(
  etiquetas: Record<string, unknown>[],
  tipo: TipoComissionador,
): Promise<void> {
  if (config.impressoraTipo.toUpperCase() !== "ZEBRA") {
    throw new Error(`Impressora nao suportada: ${config.impressoraTipo}`);
  }
  if (etiquetas.length === 0) {
    return;
  }

  // as 2 primeiras impressoes sempre falham -> 2 etiquetas fake sacrificiais no topo
  const fake: Record<string, unknown> = {
    EPC: "1".repeat(24),
    DESCRICAO: "_DESCARTAR_",
    CODIGO: "_DESCARTAR_",
    SERIE: "_DESCARTAR_",
    LOTE: "_DESCARTAR_",
    VALIDADE: "_DESCARTAR_",
  };
  const comFakes = [fake, fake, ...etiquetas];

  // escolhe o modelo ZPL e preenche os placeholders @CAMPO@ de cada etiqueta
  const model = tipo === TipoComissionador.SERIE ? MODEL_SERIE : MODEL_LOTE;
  const zpl = comFakes
    .map((e) => model.replace(/@(\w+)@/g, (_, k) => String(e[k] ?? "")))
    .join("");

  // Zebra ZD621R: ZPL cru na porta 9100
  const socket = await Bun.connect({
    hostname: config.impressoraIp,
    port: 9100,
    socket: {
      data() {},
      error(_s, err) {
        console.error("erro impressora:", err);
      },
    },
  });

  socket.write(zpl);
  socket.flush();
  socket.end();
}
