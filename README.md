# Amigo Secreto — Node.js + Firebase Firestore

O Render hospeda o site Node.js. O **Cloud Firestore** guarda participantes, presentes e fotos. Este projeto **não utiliza Firebase Storage, não exige bucket do Storage e não usa DATABASE_URL/PostgreSQL**.

## Funcionalidades

- Página inicial com valor mínimo de R$ 70.
- Participação com nome, foto de perfil opcional, comentário e até 20 presentes.
- Cada presente aceita preço médio, até 5 links e até 4 fotos.
- Seleção de vários itens, soma dos preços, pesquisa no Google e escolha aleatória local.
- Edição do próprio cadastro com sessão anônima Firebase persistida no navegador.
- Sem histórico de visualizações nem exibição de quem abriu cada lista.
- Interface branca e minimalista, inspirada no Google Forms, responsiva para celular e desktop.

## Como as fotos são salvas (sem Firebase Storage)

O navegador reduz as imagens para JPEG, converte para Data URL/Base64 e grava os dados diretamente no Firestore — a mesma abordagem do projeto Aroma usado como referência. A foto de perfil fica no documento do participante; cada presente fica em um documento separado na subcoleção `participants/{id}/items`, com suas próprias imagens.

Essa separação evita colocar toda a lista e todas as fotos em um único documento. Cada imagem é reduzida para até aproximadamente 90 KB e cada presente aceita até 4 fotos. O limite global é de 10 fotos por cadastro, incluindo a foto de perfil. Os arquivos originais podem ter até 2 MB. O Firestore tem limite de 1 MiB por documento e cotas gratuitas de uso; fotos em Base64 consomem o armazenamento e o tráfego do Firestore, então evite fotos desnecessariamente grandes.

**Não é necessário ativar Firebase Storage, criar bucket ou publicar `storage.rules`.** Se você já cadastrou `FIREBASE_STORAGE_BUCKET` no Render, pode deixar a variável lá ou removê-la; esta versão não a utiliza.

## 1. Configurar o Firebase

No [Firebase Console](https://console.firebase.google.com/), escolha seu projeto.

### Authentication

1. Abra **Authentication → Sign-in method**.
2. Ative **Anonymous (Anônimo)**. O UID anônimo identifica o navegador que criou o cadastro e permite a edição pelo mesmo navegador.
3. Em **Authentication → Settings → Authorized domains**, inclua o domínio do seu serviço Render (por exemplo, `seu-site.onrender.com`).

### Firestore Database

1. Abra **Firestore Database** e crie o banco, caso ainda não exista.
2. Entre em **Rules**.
3. Substitua as regras pelo conteúdo completo do arquivo `firestore.rules` deste projeto.
4. Clique em **Publish / Publicar**.

Atenção: autorizar o domínio em Authentication não libera a leitura ou gravação do Firestore. As regras do arquivo `firestore.rules` precisam ser publicadas no mesmo projeto cujo ID está em `FIREBASE_PROJECT_ID`.

### Configuração do aplicativo Web

Em **Project settings → General → Your apps**, registre ou selecione um aplicativo Web e copie:

- `apiKey`
- `authDomain`
- `projectId`
- `messagingSenderId`
- `appId`

`storageBucket` e `measurementId` não são necessários para esta versão.

## 2. Configurar no Render

1. Envie os arquivos deste projeto para a raiz do repositório GitHub.
2. No Render, use **New → Web Service** e conecte o repositório (ou use Blueprint com `render.yaml`).
3. Build Command: `npm install`.
4. Start Command: `npm start`.
5. Em **Environment**, configure estas cinco variáveis:

| Variável no Render | Campo da configuração Web Firebase |
|---|---|
| `FIREBASE_API_KEY` | `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `FIREBASE_APP_ID` | `appId` |

Salve as variáveis e faça o deploy. O Node.js gera `/config.js` automaticamente. Não configure `DATABASE_URL` nem `FIREBASE_STORAGE_BUCKET`.

## 3. Publicar as regras pelo Firebase CLI (opcional)

O arquivo `firebase.json` aponta apenas para as regras do Firestore. Com o Firebase CLI instalado e autenticado:

```bash
firebase use --add
# Selecione o projeto que corresponde a FIREBASE_PROJECT_ID
firebase deploy --only firestore:rules
```

Também é possível copiar `firestore.rules` diretamente para **Firestore Database → Rules** no Console.

## Segurança e limitações

- A leitura das listas e presentes é pública para os participantes consultarem os desejos.
- Criar, editar e excluir cadastro exige sessão Firebase autenticada; alterações só são aceitas para o UID proprietário.
- As subcoleções de presentes usam regras que verificam o proprietário no documento principal.
- A foto e os dados do participante são públicos para quem tem acesso ao site; não coloque informações sensíveis nos comentários ou fotos.
- O UID anônimo fica no navegador. Limpar dados do site, trocar de navegador ou aparelho pode impedir a edição do cadastro antigo. Não há recuperação automática nesta versão.
- A escolha de presentes fica apenas no navegador e não é enviada ao Firestore.
- O aplicativo não registra quem visita cada lista. O provedor de hospedagem pode manter logs técnicos gerais.
- As chaves da configuração Web identificam o projeto; a proteção das operações é feita pelas regras do Firestore. Nunca coloque uma conta de serviço Firebase Admin no navegador.
- O plano gratuito do Firestore tem cotas de armazenamento, leitura e gravação. Se o uso ultrapassar as cotas, o Firebase pode limitar as operações; acompanhe o uso no Console.

## Rodar localmente

```bash
cp .env.example .env
# Preencha as cinco variáveis; depois carregue o .env no seu ambiente ou configure-as no terminal.
npm start
```

Execute `node --env-file=.env server.js` (Node.js 20.6 ou superior) e abra `http://localhost:3000`.

## Arquivos principais

- `server.js`: servidor Node.js e geração de `/config.js` a partir das variáveis do Render.
- `public/firebase.js`: autenticação anônima, compressão das imagens para Base64 e operações Firestore. Não importa o SDK do Firebase Storage.
- `public/app.js`: interface, formulários, listas, fotos, busca Google e soma dos presentes.
- `firestore.rules`: leitura pública e gravação limitada ao proprietário.
- `firebase.json`: publicação das regras do Firestore pelo Firebase CLI.
- `render.yaml`: configuração do serviço Render sem PostgreSQL e sem Storage.
