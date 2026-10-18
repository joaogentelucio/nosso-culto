# Nosso Culto

Projeto desktop independente para projeção em igrejas, com **React + TypeScript + Vite + Tauri 2**.

## Recursos da base
Biblioteca de músicas e textos, pesquisa, cadastro, edição e exclusão; slides por parágrafos; ordem do culto; janela de projeção independente; temas; ocultar/mostrar; atalhos; persistência local.

## Executar no Windows
Instale Node.js 22+, Rust, Microsoft C++ Build Tools e WebView2. Depois execute:

```bash
npm install
npm run icons
npm run tauri dev
```

## Compilar instaladores

```bash
npm run icons
npm run tauri build
```

Instaladores: `src-tauri/target/release/bundle`. O GitHub Actions faz o build para Windows ao publicar na branch `main`; consulte a aba **Actions** para baixar os artefatos caso a execução conclua com sucesso.

## Operação
Para usar projetor, configure o Windows em **Estender telas**, abra a janela de projeção e mova-a para o segundo monitor. Setas avançam ou voltam slides; ESC oculta a projeção. Separe os slides deixando uma linha em branco no editor.

## Limitações desta versão
Primeira implementação, não testada em máquina Windows nesta sessão. A biblioteca de Bíblia completa, banco de dados SQLite, importação de arquivos e controles avançados de mídia ainda não estão implementados. Este projeto não é afiliado ao Holyrics.
