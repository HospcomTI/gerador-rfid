import * as XLSX from "xlsx";
import { config } from "../config";
import { SEPARATOR } from "../constants";
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

// Usecase: gerar arquivo WorldTech - Comissionador.
export async function gerarArquivoComissionador(): Promise<void> {
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

      return {
        tipo,
        itemCode: linha[2],
        descricao: linha[3],
        serieCode,
        loteCode,
        quantidade: linha[8],
        validade: validadePorChave.get(chave(linha[2], linha[7])),
      };
    })
    .filter((l) => l.tipo) as (ItemBase & { tipo: number })[];

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

  const header = [
    "DE CODIGO",
    "CODIGO",
    "TIPO",
    "DE LOTE",
    "LOTE",
    "QUANTIDADE",
    "DESCRICAO",
    "VALIDADE",
  ];

  const linhas = base.map((i) => {
    const serie = i.tipo === TipoComissionador.SERIE;
    const deLoteCode = serie
      ? mapaSerie.get(`${i.itemCode}${SEPARATOR}${i.serieCode}`)
      : mapaLote.get(`${i.itemCode}${SEPARATOR}${i.loteCode}`);

    return [
      mapaItem.get(String(i.itemCode)),
      i.itemCode,
      i.tipo,
      deLoteCode,
      serie ? i.serieCode : i.loteCode,
      i.quantidade,
      i.descricao,
      serie ? "" : (i.validade ?? ""),
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...linhas]);
  const wbOut = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbOut, ws, "Comissionador");

  const out = XLSX.write(wbOut, { type: "buffer", bookType: "xlsx" });
  await Bun.write(config.xlsxOutPath, out);

  console.log("arquivo comissionador gerado:", config.xlsxOutPath, base.length);
}
