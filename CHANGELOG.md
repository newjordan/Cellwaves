# Changelog

All notable changes to CellWave will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-XX

### 🎉 Initial Release

#### ✨ Features
- **Dual Grid Systems**: Support for both square and hexagonal grids
- **Interactive Forces**: Currents, emitters, obstacles, and procedural noise
- **Real-time Visualization**: Canvas-based fluid flow rendering
- **Hexagonal Grid Physics**: Based on Hamilton & Torin (2014) research
- **3D Simplex Noise**: Temporal noise patterns for natural flow
- **Quadtree Optimization**: Spatial partitioning for performance
- **Layer Management**: Multiple independent force layers with UI controls
- **Interactive Controls**: Mouse-based force manipulation

#### 🎨 UI Components
- Grid size control (10-420 cells)
- Visual density adjustment (2x-8x)
- Physics parameter tuning (advection, diffusion, visual scale)
- Real-time performance stats
- Per-layer controls for all force types
- Toggle between grid systems

#### 📚 Documentation
- Comprehensive README with API examples
- Contributing guidelines
- Code of Conduct
- GitHub issue and PR templates
- MIT License

#### 🛠️ Technical
- Pure JavaScript implementation (zero dependencies)
- ES6 module architecture
- Proper project structure (src/, demo/, docs/)
- Performance monitoring and FPS tracking

---

## Release Notes Format

### [Version] - YYYY-MM-DD

#### Added
- New features

#### Changed
- Changes to existing features

#### Deprecated
- Features marked for removal

#### Removed
- Removed features

#### Fixed
- Bug fixes

#### Security
- Security improvements

---

## Upcoming

### Planned for v1.1.0
- [ ] Mobile responsiveness improvements
- [ ] Preset configurations (ocean waves, vortex field, etc.)
- [ ] Export/import simulation states
- [ ] Additional noise patterns
- [ ] Performance optimizations for large grids

### Planned for v2.0.0
- [ ] WebGL renderer for enhanced performance
- [ ] 3D visualization mode
- [ ] Recording and playback
- [ ] Custom force scripting API

---

**Note**: This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backward compatible manner
- **PATCH** version for backward compatible bug fixes
