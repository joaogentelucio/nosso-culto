# Nosso Culto — Electron + React

Aplicativo desktop Windows para projeção em cultos, desenvolvido com **Electron, React, TypeScript e Vite**. Não usa Tauri, Rust nem React Native Windows.

## Requisitos

- Windows 10/11 e Node.js 22 ou superior (com npm).
- Para compilar o instalador, execute os comandos em Windows ou use o workflow do GitHub Actions.

## Iniciar desenvolvimento

```powershell
npm install
npm run dev
```

Abre a janela desktop do Electron. Para testar a interface isolada no navegador: `npm run dev:web`.

## Criar o instalador

```powershell
npm run dist:win
```

O instalador NSIS fica em `release/`. No GitHub, abra **Actions → Build Windows (Electron)** e baixe o artefato da execução bem-sucedida. Esta versão ainda não possui assinatura de código; o SmartScreen pode exibir alerta de editor desconhecido.

## Funcionalidades

- Biblioteca de músicas e textos com criação, edição, exclusão e pesquisa.
- Divisão de letras em slides (separe com uma linha em branco).
- Programação do culto com reordenação dos itens.
- Segunda janela independente de projeção, posicionada automaticamente em um monitor externo, quando disponível.
- Seleção de monitor, exibição em tela cheia, tela preta, 3 temas e navegação por teclado.
- Armazenamento offline em arquivo JSON no diretório do usuário do Electron, e importação/exportação de backups.

## Projeção

Conecte um segundo monitor ou projetor e configure o Windows para **Estender**. Selecione o monitor no painel e clique em **Abrir projetor**. A projeção será aberta em uma janela independente. Para alterar slides, opere pelo painel principal; as alterações são enviadas via IPC para a janela de projeção.

## Escopo desta versão

Não há banco SQLite, Bíblia licenciada, vídeo de fundo, músicas importadas de outras soluções ou integração com streaming. Projeto independente, não afiliado ao Holyrics. A arquitetura Electron renderiza a interface web via Chromium dentro de janelas desktop; não é React Native Windows nem UI WinUI nativa.
