import * as XLSX from "xlsx";
import { config } from "../config";
import { SEPARATOR } from "../constants";
import { db } from "../db";
import { TipoComissionador, TipoMap } from "../enum";
import { enviarParaImpressora } from "../impressora";
import type { ItemBase } from "./atualizar-base";
import { apiErrorMessage, apiFetch } from "../lib/apiClient";

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
export async function imprimirEtiquetasApi(
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
  console.debug("selecionadas", selecionadas);
  // junta aba 1 com validade da aba 2
  // aba 1: C=2 (Nº item), D=3 (Descricao), E=4 (Nº serie),
  //        H=7 (Nº lote), I=8 (Quantidade)
  const base = selecionadas
    .map((linha) => {
      const serieCode = String(linha[4] || '').trim();
      const loteCode = String(linha[7] || '').trim();

      let tipo = 0;

      if (!!loteCode) {
        tipo = TipoComissionador.LOTE;
      }

      if (!!serieCode) {
        tipo = TipoComissionador.SERIE;
      }

      let validade = validadePorChave.get(chave(linha[2], linha[7]));

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
        binCode: String(linha[1] || '').trim(),
        itemCode: String(linha[2] || '').trim(),
        descricao: String(linha[3] || '').trim(),
        serieCode,
        loteCode,
        quantidade: linha[8],
        validade: String(validade || ''),
      };
    })
    .filter((l) => l.tipo === tipo) as (ItemBase & { tipo: number })[];

    if (!base.length) {
      return;
    }

   const response = await apiFetch(`/epc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tipo,
      items: base
    }),
  });

  if (!response.ok) {
     throw new Error(
      await apiErrorMessage(response, "Falha ao reiniciar a conferencia"),
    );
  }

  const rfids = await response.json() as Record<string, unknown>[]

  await enviarParaImpressora(rfids, tipo);
}
