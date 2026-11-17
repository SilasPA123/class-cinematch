# Class CineMatch

A small class activity. Everyone enters a name and four favorite films, and the page shows who has
similar taste and why. Entries update live for the whole class.

- Static site (HTML, CSS, JS modules), no build step.
- Film search and metadata from [TMDB](https://www.themoviedb.org/). This product uses the TMDB API
  but is not endorsed or certified by TMDB.
- Shared entries in Firebase Firestore, with anonymous sign-in so each person can only edit their own entry
  (`firestore.rules`).
- Optional Letterboxd import through a small Cloudflare Worker (`worker/letterboxd-worker.js`).

Setup notes (in Portuguese) are in `SETUP.md`. The matching logic is in `match.js`.

To run locally: `python -m http.server 8765`, then open http://localhost:8765.
