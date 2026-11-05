# Amigo Secreto — Node.js + Firebase

Versão do Amigo Secreto adaptada usando a mesma abordagem de configuração Firebase do projeto AromaShop enviado como referência. O Render serve o site Node.js; Firestore guarda participantes e listas; Firebase Storage guarda as fotos. **Não usa PostgreSQL nem DATABASE_URL.**

## Recursos
- Página inicial com valor mínimo de R$ 70.
- Cadastro com nome, foto pessoal opcional, observações e até 20 presentes.
- Cada presente aceita preço médio, até 5 links e até 4 fotos.
- Seleção de vários itens, soma dos preços, pesquisa Google e escolha aleatória local.
- Edição do próprio cadastro protegida pela sessão anônima persistente do Firebase Authentication.
- O aplicativo não grava nem mostra histórico de visualizações. A seleção de presentes fica no navegador.
- Imagens no Firebase Storage e dados no Firestore.

## 1. Configurar o Firebase
No [Firebase Console](https://console.firebase.google.com/), crie ou escolha um projeto.

### Authentication
1. Abra **Authentication → Sign-in method**.
2. Ative **Anonymous (Anônimo)**. É usado para dar a cada navegador uma identidade Firebase persistente e permitir que somente o dono edite seu cadastro.

### Firestore
1. Abra **Firestore Database → Create database**.
2. Crie o banco (modo produção).
3. Abra a aba **Rules** (não é a tela de Authentication nem Realtime Database).
4. Substitua as regras existentes pelo conteúdo do arquivo `firestore.rules` deste projeto e clique em **Publish / Publicar**.

**Atenção:** autorizar o domínio do Render em Authentication → Settings → Authorized domains só permite o fluxo de autenticação. Isso não libera consultas ao Firestore. O erro `permission-denied: Missing or insufficient permissions` ao abrir a lista de participantes geralmente significa que as regras do Firestore ainda não foram publicadas no projeto correto.

### Storage
1. Abra **Storage → Get started** e crie o bucket.
2. Abra **Rules**, substitua as regras pelo conteúdo de `storage.rules` deste projeto e clique em **Publish / Publicar**. Isso é necessário para enviar e exibir fotos.

### Publicar regras pela linha de comando (opcional)
O arquivo `firebase.json` incluído já aponta para `firestore.rules` e `storage.rules`. Com o Firebase CLI instalado e autenticado, execute na pasta do projeto:

```bash
firebase use --add
# Selecione exatamente o projeto cujo ID está em FIREBASE_PROJECT_ID
firebase deploy --only firestore:rules,storage
```

Também é possível publicar copiando os dois arquivos diretamente nas respectivas abas **Rules** do Console do Firebase.

### Chaves do aplicativo web
1. Em **Project settings → General → Your apps**, registre um aplicativo Web (ícone `</>`).
2. Copie os campos da configuração do Firebase: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` e `appId`.

## 2. Configurar no Render
1. Envie os arquivos deste projeto para o GitHub.
2. No Render, escolha **New → Web Service** e conecte o repositório (ou **Blueprint** para ler `render.yaml`).
3. Build Command: `npm install`; Start Command: `npm start`.
4. Em **Environment**, adicione estas variáveis com os valores do aplicativo Web do Firebase:

| Variável Render | Campo Firebase |
|---|---|
| `FIREBASE_API_KEY` | `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `FIREBASE_APP_ID` | `appId` |

5. Salve e faça o deploy. O servidor gera `/config.js` automaticamente a partir dessas variáveis.

Não configure `DATABASE_URL`: este projeto não utiliza PostgreSQL.

## 3. Observações de segurança e funcionamento
- As chaves da configuração Web do Firebase identificam o projeto; a proteção real dos dados depende das regras de Firestore e Storage publicadas acima.
- A regra do Firestore permite leitura pública das listas e escrita apenas pelo UID anônimo proprietário.
- O UID é mantido pelo Firebase Authentication no armazenamento local do navegador. Se a pessoa limpar os dados do site, trocar de navegador ou aparelho, pode perder a capacidade de editar o cadastro. Não há recuperação automática nesta versão.
- Não existe coleção, endpoint ou função de analytics/visitas no aplicativo. O provedor de hospedagem e a infraestrutura de rede ainda podem manter logs técnicos próprios.
- A configuração do Firebase Web não deve ser tratada como senha. Nunca coloque uma conta de serviço Firebase Admin no navegador.
- O Storage precisa estar habilitado no projeto Firebase e as regras precisam ser publicadas. O Firebase pode exigir plano de cobrança Blaze para habilitar Storage em projetos novos; confira as condições atuais do seu projeto.
- Para teste local, defina as seis variáveis de ambiente antes de `npm start`. O arquivo `public/config.js` local fica vazio de propósito.

## Rodar localmente
```bash
npm start
```
Abra `http://localhost:3000` após configurar as variáveis de ambiente.

## Arquivos importantes
- `server.js`: servidor Node.js e geração segura de `/config.js` a partir do ambiente.
- `public/firebase.js`: autenticação anônima, Firestore e Storage.
- `firestore.rules`: leitura pública e edição limitada ao proprietário. Precisa ser publicada no Console do Firebase; o deploy do Render não publica regras.
- `storage.rules`: fotos públicas para leitura e gravação apenas pelo proprietário. Também precisa ser publicada no Console.
- `firebase.json`: configuração para publicar ambas as regras com Firebase CLI.
- `render.yaml`: variáveis Firebase solicitadas ao criar o serviço.

## Identidade visual
A interface foi redesenhada com inspiração na clareza visual do Google Forms: fundo lavanda muito claro, cartões brancos, tipografia sem serifa, campos com bordas suaves e detalhes em violeta. O layout é responsivo para celular e desktop. A atualização visual não altera a estrutura do Firestore nem o fluxo de autenticação.
