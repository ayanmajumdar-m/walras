# Rule: Automatic Build and Push to Main

## Principle
Whenever any change, update, feature, or bugfix is implemented in this codebase:
1. Rebuild the React frontend if client files were modified (`npm run build` in `client/`).
2. Stage all changed files (`git add`).
3. Commit with a clear, descriptive conventional commit message (`git commit -m "..."`).
4. Automatically push directly to `origin/main` (`git push origin main`).
5. Verify the working tree is clean and confirm the commit hash and deployment status to the user.
