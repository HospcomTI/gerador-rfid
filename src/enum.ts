// type do tb_map (coluna `type`)
export enum TipoMap {
  ITEM = "item",
  SERIE = "serie",
  LOTE = "lote",
}

// coluna TIPO do arquivo comissionador
export enum TipoComissionador {
  SERIE = 1,
  LOTE = 2,
}

// IMPRESSORA_TIPO do .env -> define a linguagem de etiqueta enviada na 9100
export enum Impressora {
  ZEBRA = "ZEBRA", // ZPL
  SATO = "SATO", // SBPL
}
