# Aplikacja iOS (właściciel studia)

Aplikacja mobilna dla właściciela/administratora (FR-31–FR-35, opcjonalnie FR-36).

## Stack (zgodnie z pracą)

- Swift + SwiftUI
- iOS 16+
- URLSession + async/await
- Keychain (tokeny JWT)
- APNs (powiadomienia push)
- Swift Charts (statystyki)

## Status

Projekt Xcode zostanie dodany w osobnym kroku (wymaga macOS + Xcode).

Do tego czasu komunikacja z API będzie odbywać się przez to samo REST API co aplikacja webowa (`apps/api`).

## Planowane ekrany

1. Logowanie (to samo konto ADMIN co w panelu web)
2. Kalendarz / dzisiejsze wizyty
3. Zgłoszenia (przegląd / zatwierdzanie)
4. Powiadomienia push
5. Skrócone statystyki
