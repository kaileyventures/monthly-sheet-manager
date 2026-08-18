# Contributing Guidelines

Thank you for considering contributing to the Monthly Sheet Manager!

## How to Contribute

1. **Fork the Repository**: Create your own branch from `main`.
2. **Make Changes**: Follow clean code practices and test in your own Google Apps Script environment.
3. **Keep Synchronized**: Ensure modifications are synced across `Sidebar.html`, `src/ui/Sidebar.html`, `Code.gs`, and modular `src/` files.
4. **Commit**: Use clear, descriptive commit messages (e.g., `feat: add new status filter`, `fix: URL parser edge case`).
5. **Update Topology**: Run `/graphify .` to update `graphify-out/graphify.html` whenever new functions or modules are added.
6. **Submit a Pull Request**: Explain your changes and link any related issues.

## Code Style
- Follow ES6 / Google Apps Script compatible syntax.
- Ensure all UI changes support both **Light** and **Dark** glassmorphic themes.
- Maintain custom 5px slim scrollbar styling (`::-webkit-scrollbar`).
- Maintain single-file compatibility in `Code.gs`.
