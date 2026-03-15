# Contributing to CellWave

Thank you for your interest in contributing to CellWave! 🌊

## 🎯 Ways to Contribute

- **Report Bugs**: Found an issue? [Open a bug report](https://github.com/newjordan/Cellwaves/issues/new)
- **Suggest Features**: Have an idea? [Create a feature request](https://github.com/newjordan/Cellwaves/issues/new)
- **Improve Documentation**: Help make the docs better
- **Submit Code**: Fix bugs or add features via pull requests
- **Create Examples**: Build cool demos using CellWave

## 🚀 Getting Started

### 1. Fork & Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/cellwave.git
cd cellwave
```

### 2. Create a Branch

```bash
git checkout -b feature/my-awesome-feature
# or
git checkout -b fix/bug-description
```

### 3. Make Your Changes

- Follow the existing code style
- Keep changes focused and atomic
- Test your changes thoroughly

### 4. Test Locally

```bash
# Start local server
python3 -m http.server 8000

# Open http://localhost:8000/demo/
# Verify your changes work
```

### 5. Commit Your Changes

```bash
git add .
git commit -m "Add: Brief description of your changes"
```

**Commit Message Guidelines:**
- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Reference issues and pull requests when relevant
- Examples:
  - `Fix: Grid boundary overflow in hexagonal mode (#42)`
  - `Add: Wave noise pattern for procedural flows`
  - `Docs: Update API documentation for force methods`

### 6. Push & Create PR

```bash
git push origin feature/my-awesome-feature
```

Then create a Pull Request on GitHub with:
- Clear title describing the change
- Description of what changed and why
- Screenshots/GIFs if visual changes
- Reference related issues

## 📝 Code Style Guidelines

### JavaScript

- **ES6+ syntax**: Use modern JavaScript features
- **Module exports**: Use ES6 `export` statements
- **Naming conventions**:
  - `camelCase` for variables and functions
  - `PascalCase` for classes
  - `UPPER_CASE` for constants
- **Comments**: Use JSDoc for public APIs

```javascript
/**
 * Adds a current to the simulation
 * @param {Object} current - Current configuration
 * @param {Object} current.start - Starting position {x, y}
 * @param {Object} current.end - Ending position {x, y}
 * @param {number} current.strength - Flow strength (0.1-2.0)
 */
addCurrent(current) {
    // Implementation
}
```

### HTML/CSS

- **Semantic HTML**: Use appropriate tags
- **Responsive**: Consider mobile users
- **Accessible**: Add ARIA labels where needed
- **Consistent naming**: Use kebab-case for CSS classes

## 🐛 Bug Reports

A good bug report includes:

1. **Clear title**: Summarize the issue
2. **Environment**:
   - Browser & version
   - Operating system
   - Screen resolution (if visual bug)
3. **Steps to reproduce**:
   - List exact steps
   - Include code snippets if relevant
4. **Expected behavior**: What should happen
5. **Actual behavior**: What actually happens
6. **Screenshots/GIFs**: If applicable
7. **Console errors**: Check browser console

**Example:**

```markdown
## Bug: Grid rendering artifacts in Firefox

**Environment:**
- Firefox 120.0
- Windows 11
- 1920×1080 display

**Steps to Reproduce:**
1. Open demo/index.html
2. Set grid size to 200
3. Switch to hexagonal grid
4. Observe flickering

**Expected:** Smooth rendering
**Actual:** Visual artifacts appear

**Console Error:**
`TypeError: Cannot read property 'x' of undefined at line 245`
```

## 💡 Feature Requests

A good feature request includes:

1. **Clear title**: Describe the feature
2. **Use case**: Why is this needed?
3. **Proposed solution**: How might it work?
4. **Alternatives**: Other approaches considered?
5. **Additional context**: Mockups, examples, references

## 🧪 Testing

Before submitting:

- ✅ Test in multiple browsers (Chrome, Firefox, Safari)
- ✅ Test different grid sizes (small, medium, large)
- ✅ Test both grid types (square and hexagonal)
- ✅ Check browser console for errors
- ✅ Verify no performance regressions
- ✅ Test on different screen sizes if UI changes

## 📚 Documentation

When adding features:

- Update README.md if user-facing
- Add JSDoc comments for public APIs
- Create examples in docs/ folder
- Update CHANGELOG.md

## 🎨 Design Principles

When contributing, keep these in mind:

1. **Performance First**: This is a real-time simulation
2. **Zero Dependencies**: Keep it pure JavaScript
3. **Educational**: Code should be readable and well-commented
4. **Configurable**: Expose parameters for experimentation
5. **Backward Compatible**: Don't break existing APIs

## ⚖️ Code Review Process

All submissions require review:

1. **Automated checks**: Ensure no syntax errors
2. **Manual review**: Maintainer reviews code
3. **Discussion**: Address feedback
4. **Approval**: Maintainer approves PR
5. **Merge**: Changes merged to main branch

Expect review within **3-5 days**. Be patient and responsive to feedback!

## 🎓 Learning Resources

New to fluid simulation?

- [Stable Fluids by Jos Stam](https://www.dgp.toronto.edu/public_user/stam/reality/Research/pdf/ns.pdf)
- [Hexagonal Grids Guide](https://www.redblobgames.com/grids/hexagons/)
- [Simplex Noise Explained](https://weber.itn.liu.se/~stegu/simplexnoise/simplexnoise.pdf)

## ❓ Questions?

- Open a [Discussion](https://github.com/newjordan/Cellwaves/discussions)
- Check [existing issues](https://github.com/newjordan/Cellwaves/issues)
- Review the [API documentation](docs/API.md)

## 📜 Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

Thank you for contributing to CellWave! 🙏
