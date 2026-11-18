# AI taste profiles: setup

The site can show a two-line, AI-written description of each person's taste ("Your taste, in two lines",
and inside each match card). It uses the Claude API through a small Cloudflare Worker, so the API key never
appears in the site's code. Until `TASTE_PROXY` in `config.js` is filled in, the feature stays hidden.

## 1. Claude API key

1. Create an account at https://console.anthropic.com and add a small amount of credit.
2. **Set a monthly spend limit** (Settings > Limits). A few dollars is plenty for a class.
3. API Keys > Create Key. Copy it (it starts with `sk-ant-`). Don't paste it into any file in this repo.

## 2. Cloudflare Worker

1. Free account at https://dash.cloudflare.com > Workers & Pages > Create > Worker ("Hello World") > Deploy.
2. Edit code: delete everything, paste the contents of `worker/taste-worker.js`, Deploy.
3. Settings > Variables and Secrets > Add: type **Secret**, name `ANTHROPIC_API_KEY`, value = your key. Deploy.
4. Copy the Worker URL (`https://<name>.<account>.workers.dev`).

## 3. Turn it on

Put the URL in `config.js`:

```js
export const TASTE_PROXY = "https://<name>.<account>.workers.dev";
```

Commit, wait a minute for GitHub Pages, and the profiles appear.

## Notes

- `ALLOWED_ORIGINS` at the top of the Worker lists the sites allowed to use it
  (`https://mariamendoza28.github.io` and localhost). Add any other address you host the site on.
- Answers are cached per film list, so each person's list costs one API call, not one per page view.
  Each call is a few hundred tokens with `claude-haiku-5-5`, so a whole class costs well under a cent.
- The origin check stops other websites from using your Worker in a browser, but a determined person could
  still call it from a script. The spend limit from step 1 is what caps the worst case.
