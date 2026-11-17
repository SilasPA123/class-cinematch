# CineMatch da Turma: setup

O site é estático (HTML + JS). Para a turma usar, faltam duas contas gratuitas e a hospedagem.
Enquanto `config.js` estiver vazio, o site roda em modo demo (dados só no navegador).

## 1. TMDB (busca e metadados dos filmes)

1. Criar conta em https://www.themoviedb.org e abrir Settings > API.
2. Pedir uma chave de uso pessoal/educacional.
3. Copiar a **API Key (v3)** para `TMDB_KEY` em `config.js`.

A chave fica visível no código do site (é assim em qualquer site estático). Para uma turma é aceitável;
se a chave vazar, basta gerar outra no painel do TMDB.

## 2. Firebase (banco em tempo real)

1. https://console.firebase.google.com > Add project (pode desligar o Google Analytics).
2. **Build > Authentication > Get started > Sign-in method > Anonymous > Enable.**
   Cada aluno recebe um id anônimo para só poder editar a própria entrada.
3. **Build > Firestore Database > Create database** (modo produção, região mais próxima).
4. Aba **Rules**: colar o conteúdo de `firestore.rules` e publicar.
5. Project settings > Your apps > **Web app (`</>`)**: registrar e copiar o objeto `firebaseConfig`
   para `FIREBASE_CONFIG` em `config.js`.
   (Esse objeto não é segredo; a proteção vem das regras do passo 4.)
6. Opcional: Authentication > Settings > Authorized domains: confirmar que o domínio de hospedagem está na lista.

## 2b. Letterboxd (opcional): Cloudflare Worker

O navegador não consegue ler `letterboxd.com` (CORS), então o site chama um proxy pequeno.

1. Criar conta gratuita em https://dash.cloudflare.com > Workers & Pages > Create > Worker ("Hello World").
2. Edit code: apagar tudo e colar o conteúdo de `worker/letterboxd-worker.js`. Deploy.
3. Copiar a URL (`https://<nome>.<conta>.workers.dev`) para `LETTERBOXD_PROXY` em `config.js`.
4. Testar abrindo `https://<nome>.<conta>.workers.dev/?user=<um usuario>`: deve voltar um JSON com 4 filmes.
5. Depois de hospedar o site, trocar `ALLOWED_ORIGIN = "*"` no Worker pelo endereço do site.

Se `LETTERBOXD_PROXY` ficar vazio, o campo do Letterboxd simplesmente não aparece (fora do localhost).
Se o Letterboxd bloquear os servidores da Cloudflare, o Worker responde `upstream_blocked` e o aluno
é orientado a usar a busca. Os títulos importados são resolvidos no TMDB, então a chave do passo 1 é necessária.

Teste local, sem conta: `node worker/dev-proxy.mjs` (porta 8766) e `python -m http.server 8765` nesta pasta.

## 3. Hospedagem (escolha uma)

- **GitHub Pages**: repo com estes arquivos, Settings > Pages > Deploy from branch (main, raiz).
  O link fica `https://<usuario>.github.io/<repo>/`.
- **Firebase Hosting**: `npm i -g firebase-tools`, `firebase login`, `firebase init hosting`
  (pasta pública = esta), `firebase deploy`.

## 4. Antes da aula

- Abrir o link em dois dispositivos e conferir que a entrada de um aparece no outro sem recarregar.
- Moderação: para apagar uma entrada, Firestore Database > participants > excluir o documento.
- Limpar a turma entre semestres: apagar a coleção `participants` no console.

## Como o match é calculado (para explicar em aula)

Cada participante tem 4 filmes. Como filmes idênticos são raros, o score soma, para cada par de pessoas:
filmes em comum (peso alto), diretores em comum, similaridade (Jaccard) de gêneros, temas (keywords do TMDB),
décadas, países e idiomas, e elenco em comum. O resultado vira uma porcentagem (curva saturante) e cada
componente que contribuiu gera uma frase de explicação. O código está em `match.js`.
