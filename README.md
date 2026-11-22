# Redesign press.suzuki.it

Prototipo cliccabile del redesign della sala stampa Suzuki Italia ([press.suzuki.it](https://press.suzuki.it)), a cura di Greta Andreolli per Lulop.

- Contenuti reali di press.suzuki.it al 20/11/2026: ultimi 20 comunicati, album, documenti e video.
- Login e download sono simulati.
- HTML, CSS e JavaScript senza dipendenze; i contenuti sono in `data/*.json`.

## Aprirlo in locale

I dati JSON si caricano solo via http, non con doppio clic su `index.html`:

```bash
python3 -m http.server 4321
```

poi aprire http://localhost:4321/ (con `?reset=1` si azzerano ricerca, filtri e selezione salvati).
