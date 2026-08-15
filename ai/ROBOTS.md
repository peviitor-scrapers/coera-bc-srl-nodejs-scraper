# Robots.txt Analysis — COERA Careers

Sursa: https://www.co-era.com/robots.txt

## Reguli

```
User-agent: *
Disallow: /img/
```

## Interpretare

| Cale | Accesibil? | Ce conține |
|---|---|---|
| `/careers/` | ✅ Allowed | Lista de job-uri (HTML) de la care scraper-ul extrage postările |
| `/careers/{slug}/` | ✅ Allowed | Paginile individuale de job (verificate în teste) |
| `/img/` | 🚫 Disallowed | Imagini statice — nu le accesăm |

## Note

- Scraper-ul folosește un singur GET pe `/careers/` (fără paginare) și extrage link-urile `a.careerButton`.
- Locatiile sunt codate în titlul job-ului, după `|` (ex: „Go beyond for your role! | Cluj & Brasov").
- Work-mode implicit: `hybrid` (COERA este o companie de consultanță software cu sediul în Cluj).
