export const SEPARATOR = "#|#";

// @see https://labelary.com/viewer.html
export const MODEL_SERIE = `
^XA
^BY2
^FO10,25^BQN,2,5^FD000@EPC@^FS

^FO125,35^A0N,14,14^FDSERIE:^FS
^FO125,50^A0N,26,26^FB300,2,0,L^FD@SERIE@^FS

^FO10,150^A0N,26,26^FB410,2,0,L^FD@CODIGO@^FS

^FO10,210^A0N,20,20^TBN,410,66^FD@DESCRICAO@^FS
^RFW,H^FD@EPC@^FS
^XZ
`;

export const MODEL_SERIE_305 = `
^XA
^BY3
^FO15,38^BQN,2,8^FD000@EPC@^FS

^FO230,53^A0N,21,21^FDSERIE:^FS
^FO230,75^A0N,39,39^FB450,2,0,L^FD@SERIE@^FS

^FO15,265^A0N,39,39^FB615,2,0,L^FD@CODIGO@^FS

^FO15,315^A0N,30,30^TBN,615,99^FD@DESCRICAO@^FS
^RFW,H^FD@EPC@^FS
^XZ
`;

// @see https://labelary.com/viewer.html
export const MODEL_LOTE = `
^XA
^BY2
^FO10,25^BQN,2,5^FD000@EPC@^FS

^FO125,35^A0N,14,14^FDLOTE:^FS
^FO125,50^A0N,26,26^FB300,2,0,L^FD@LOTE@^FS

^FO125,105^A0N,14,14^FDVALIDADE:^FS
^FO125,120^A0N,26,26^FB410,1,0,L^FD@VALIDADE@^FS

^FO10,150^A0N,26,26^FB410,2,0,L^FD@CODIGO@^FS

^FO10,210^A0N,20,20^TBN,410,66^FD@DESCRICAO@^FS
^RFW,H^FD@EPC@^FS
^XZ
`;

export const MODEL_LOTE_305 = `
^XA
^BY3
^FO15,38^BQN,2,8^FD000@EPC@^FS

^FO230,53^A0N,21,21^FDLOTE:^FS
^FO230,75^A0N,39,39^FB450,2,0,L^FD@LOTE@^FS

^FO230,158^A0N,21,21^FDVALIDADE:^FS
^FO230,180^A0N,39,39^FB615,1,0,L^FD@VALIDADE@^FS

^FO15,265^A0N,39,39^FB615,2,0,L^FD@CODIGO@^FS

^FO15,315^A0N,30,30^TBN,615,99^FD@DESCRICAO@^FS
^RFW,H^FD@EPC@^FS
^XZ
`;

// Etiqueta de endereco (posicao no deposito).
// So o QR e o bincode em texto grande logo abaixo dele; o EPC nao sai
// impresso, vai apenas dentro do QR e gravado na tag.
// @see https://labelary.com/viewer.html
export const MODEL_ENDERECO = `
^XA
^BY2
^FO10,25^BQN,2,5^FD000@EPC@^FS

^FO10,155^A0N,14,14^FDENDERECO:^FS
^FO10,175^A0N,40,40^FB410,2,0,L^FD@BINCODE@^FS
^RFW,H^FD@EPC@^FS
^XZ
`;

export const MODEL_ENDERECO_305 = `
^XA
^BY3
^FO15,38^BQN,2,8^FD000@EPC@^FS

^FO15,233^A0N,21,21^FDENDERECO:^FS
^FO15,263^A0N,60,60^FB615,2,0,L^FD@BINCODE@^FS
^RFW,H^FD@EPC@^FS
^XZ
`;



// Etiqueta de endereco (posicao no deposito).
// So o QR e o bincode em texto grande logo abaixo dele; o EPC nao sai
// impresso, vai apenas dentro do QR e gravado na tag.
// @see https://labelary.com/viewer.html
export const MODEL_ITEM = `
^XA
^BY2
^FO10,25^BQN,2,5^FD000@EPC@^FS

^FO10,155^A0N,14,14^FDCOD. ITEM:^FS
^FO10,175^A0N,26,26^FB410,2,0,L^FD@CODIGO@^FS
^FO10,210^A0N,20,20^TBN,410,66^FD@DESCRICAO@^FS
^RFW,H^FD@EPC@^FS
^XZ
`;

export const MODEL_ITEM_305 = `
^XA
^BY3
^FO15,38^BQN,2,8^FD000@EPC@^FS

^FO15,233^A0N,21,21^FDCOD. ITEM:^FS
^FO15,265^A0N,39,39^FB615,2,0,L^FD@CODIGO@^FS
^FO15,315^A0N,30,30^TBN,615,99^FD@DESCRICAO@^FS
^RFW,H^FD@EPC@^FS
^XZ
`;

// Segmentos fixos do EPC de endereco (24 digitos no total):
// ORG(4) + COD_ITEM(6) + TIPO(1) + SEQUENCIAL(5) + "000"(3) + CODE(5)
// So o sequencial varia; o resto e constante para toda etiqueta de endereco.
export const ENDERECO_COD_ITEM = "000001";
export const ENDERECO_CODE = 1;
