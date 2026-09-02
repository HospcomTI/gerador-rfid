import { imprimirEtiquetas } from "./src/usecases/imprimir-etiquetas";
import { imprimirEnderecos } from "./src/usecases/imprimir-endereco";
import { gerarArquivoComissionador } from "./src/usecases/gerar-arquivo-comissionador";
import { atualizarBase } from "./src/usecases/atualizar-base";
import { TipoComissionador } from "./src/enum";
import { db } from "./src/db";
import { runMigrations } from "./src/migrations/runner";
import index from "./src/views/index.html";
import { imprimirEtiquetasApi } from "./src/usecases/imprimir-etiquetas-api";
import { imprimirEnderecosApi } from "./src/usecases/imprimir-endereco-api";

// roda migrations pendentes no boot
await runMigrations(db);

const server = Bun.serve({
  port: 8080,
  routes: {
    "/": index,

    // "/atualizar-base": {
    //   POST: async () => {
    //     await atualizarBase();
    //     return Response.redirect("/", 303);
    //   },
    // },

    "/imprimir-etiquetas-api": {
      POST: async (req) => {
        const tipo = Number(new URL(req.url).searchParams.get("tipo"));
        if (tipo !== TipoComissionador.SERIE && tipo !== TipoComissionador.LOTE) {
          return new Response("tipo invalido (use ?tipo=1 ou ?tipo=2)", {
            status: 400,
          });
        }
        await imprimirEtiquetasApi(tipo);
        return Response.redirect("/", 303);
      },
    },

    "/imprimir-enderecos-api": {
      POST: async () => {
        await imprimirEnderecosApi();
        return Response.redirect("/", 303);
      },
    },

    // "/imprimir-etiquetas": {
    //   POST: async (req) => {
    //     const tipo = Number(new URL(req.url).searchParams.get("tipo"));
    //     if (tipo !== TipoComissionador.SERIE && tipo !== TipoComissionador.LOTE) {
    //       return new Response("tipo invalido (use ?tipo=1 ou ?tipo=2)", {
    //         status: 400,
    //       });
    //     }
    //     await imprimirEtiquetas(tipo);
    //     return Response.redirect("/", 303);
    //   },
    // },

    // "/imprimir-enderecos": {
    //   POST: async () => {
    //     await imprimirEnderecos();
    //     return Response.redirect("/", 303);
    //   },
    // },

    // "/gerar-arquivo-comissionador": {
    //   POST: async () => {
    //     await gerarArquivoComissionador();
    //     return Response.redirect("/", 303);
    //   },
    // },
  },
});

console.log(`Listening on ${server.url}`);
