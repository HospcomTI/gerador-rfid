import { config } from "./config";
import {
  MODEL_ENDERECO,
  MODEL_ENDERECO_305,
  MODEL_LOTE,
  MODEL_LOTE_305,
  MODEL_SERIE,
  MODEL_SERIE_305,
} from "./constants";
import { TipoComissionador } from "./enum";

// Envia as etiquetas (termica + RFID) para a impressora Zebra via ZPL (TCP 9100).
export async function enviarParaImpressora(
  etiquetas: Record<string, unknown>[],
  tipo: TipoComissionador,
): Promise<void> {
  // if (config.impressoraTipo.toUpperCase() !== "ZEBRA") {
  //   throw new Error(`Impressora nao suportada: ${config.impressoraTipo}`);
  // }
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
    BINCODE: "_DESCARTAR_",
  };
  const comFakes = [fake, fake, ...etiquetas];

  // escolhe o modelo ZPL e preenche os placeholders @CAMPO@ de cada etiqueta
  const model = (() => {
    const d305 = config.dpi === "305";
    switch (tipo) {
      case TipoComissionador.SERIE:
        return d305 ? MODEL_SERIE_305 : MODEL_SERIE;
      case TipoComissionador.LOTE:
        return d305 ? MODEL_LOTE_305 : MODEL_LOTE;
      case TipoComissionador.ENDERECO:
        return d305 ? MODEL_ENDERECO_305 : MODEL_ENDERECO;
    }
  })();
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
