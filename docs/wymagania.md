# Wymagania systemu (skrót z pracy inżynierskiej)

Źródło: `Praca_inz.docx` (stan: 14.10.2026).

## Aktorzy

| Aktor | Opis |
| --- | --- |
| Gość | Portfolio, kalkulator, rejestracja |
| Klient | Zgłoszenia, wiadomości, rezerwacje, zadatki, dokumenty |
| Artysta | Wyceny, grafik, sesje, portfolio |
| Właściciel (ADMIN) | Panel web + aplikacja iOS |
| Stripe | Płatności zadatków |
| SMTP / APNs | E-mail i push |

## Priorytety

- **Wysoki** – MVP (od zgłoszenia do zadatku i sesji)
- **Średni** – wygoda / właściciel
- **Niski** – rozszerzenia (FR-36–FR-40)

## FR – funkcjonalne (checklist implementacji)

### Konta i autoryzacja

- [ ] FR-01 Rejestracja + weryfikacja e-mail *(wysoki)*
- [ ] FR-02 Logowanie / wylogowanie / JWT *(wysoki)*
- [ ] FR-03 Reset hasła *(średni)*
- [ ] FR-04 Role: CLIENT / ARTIST / ADMIN *(wysoki)*
- [ ] FR-05 Edycja profilu + usunięcie konta (RODO) *(średni)*

### Prezentacja studia

- [ ] FR-06 Publiczne portfolio artystów *(średni)*

### Zgłoszenia i wycena

- [ ] FR-07 Formularz zgłoszenia *(wysoki)*
- [ ] FR-08 Zdjęcia referencyjne (typ/rozmiar) *(wysoki)*
- [ ] FR-09 Kalkulator widełek cenowych *(wysoki)*
- [ ] FR-10 Wątek wiadomości klient–artysta *(wysoki)*
- [ ] FR-11 Wycena ostateczna + akceptacja *(wysoki)*
- [ ] FR-12 Statusy zgłoszenia *(wysoki)*

### Terminy i rezerwacje

- [ ] FR-13 Grafik i nieobecności artysty *(wysoki)*
- [ ] FR-14 Wolne terminy *(wysoki)*
- [ ] FR-15 Rezerwacja bez kolizji (exclusion constraint) *(wysoki)*
- [ ] FR-16 Projekty wieloetapowe *(wysoki)*
- [ ] FR-17 Zmiana / odwołanie wg reguł *(wysoki)*
- [ ] FR-18 Przypomnienia e-mail/push *(średni)*

### Płatności

- [ ] FR-19 Zadatek Stripe jako warunek potwierdzenia *(wysoki)*
- [ ] FR-20 Reguły zadatku (przeniesienie / przepadek) *(średni)*
- [ ] FR-21 Historia / zestawienie wpłat *(średni)*

### Dokumenty

- [ ] FR-22 Zgoda na zabieg (wersja + data) *(wysoki)*
- [ ] FR-23 Ankieta zdrowotna (ograniczony dostęp) *(wysoki)*
- [ ] FR-24 Weryfikacja pełnoletności *(średni)*
- [ ] FR-25 Historia klienta *(średni)*

### Panel administratora

- [ ] FR-26 Artyści *(wysoki)*
- [ ] FR-27 Usługi / parametry kalkulatora *(wysoki)*
- [ ] FR-28 Kalendarz wszystkich artystów *(wysoki)*
- [ ] FR-29 Reguły (zadatek, okna odwołań, przypomnienia) *(średni)*
- [ ] FR-30 Statystyki i raporty *(średni)*

### iOS (właściciel)

- [ ] FR-31 Logowanie *(wysoki)*
- [ ] FR-32 Kalendarz / dzisiejsze wizyty *(wysoki)*
- [ ] FR-33 Zatwierdzanie zgłoszeń *(średni)*
- [ ] FR-34 Push *(średni)*
- [ ] FR-35 Skrócone statystyki *(średni)*

### Rozszerzenia (niski)

- [ ] FR-36 Portfolio z iOS + zgoda na publikację
- [ ] FR-37 Opinie
- [ ] FR-38 Rabat urodzinowy
- [ ] FR-39 System poleceń
- [ ] FR-40 Weryfikacja telefonu + blokada kont

## NFR – niefunkcjonalne

- [ ] NFR-01 HTTPS + hasła Argon2id
- [ ] NFR-02 OWASP Top 10 + walidacja serwerowa
- [ ] NFR-03 RBAC na API + rate limit logowania
- [ ] NFR-04 RODO (dane zdrowotne, zgody, usuwanie)
- [ ] NFR-05 Pliki przez signed URL / auth
- [ ] NFR-06 Wydajność API ~500 ms / homepage ~3 s (cele)
- [ ] NFR-07 Backup DB codziennie, dostępność ~99%
- [ ] NFR-08 Transakcje + exclusion constraint na terminach
- [ ] NFR-09 UI PL, responsywny
- [ ] NFR-10 Zgłoszenie ≤ 5 kroków, WCAG 2.1 AA (podstawy)
- [ ] NFR-11 Chrome/Firefox/Safari/Edge + iOS 16+
- [ ] NFR-12 OpenAPI + testy (Jest / Playwright / XCTest)
- [ ] NFR-13 Docker + env + CI/CD

## Scenariusze kluczowe

1. **SC-1** Zgłoszenie + wycena orientacyjna
2. **SC-2** Wycena artysty + akceptacja klienta
3. **SC-3** Rezerwacja + zadatek (blokada terminu ~15 min)
4. **SC-4** Zmiana / odwołanie (okno np. 48 h)
