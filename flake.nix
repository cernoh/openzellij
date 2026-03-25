{
  description = "OpenCode plugin development environment for openzellij";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        
        # OpenCode plugin development tools
        devTools = with pkgs; [
          # Runtime environments
          nodejs_22
          bun
          
          # Build tools
          esbuild
          
          # Development tools
          typescript
          nodePackages.typescript-language-server
          
          
          # Zellij for testing integration
          zellij
          
          # Git for version control
          git
          
          # Useful utilities
          jq
          watchexec
        ];
        
      in
      {
        # Development shell
        devShells.default = pkgs.mkShell {
          buildInputs = devTools;
          
          shellHook = ''
            echo "🔧 OpenCode Plugin Development Environment"
            echo ""
            echo "Available commands:"
            echo "  bun install      - Install dependencies"
            echo "  bun run build    - Build the plugin"
            echo "  bun run dev      - Build in watch mode"
            echo "  bun run test     - Run tests"
            echo "  bun run typecheck - Type check"
            echo ""
            echo "Tools available:"
            echo "  Node.js: $(node --version)"
            echo "  Bun: $(bun --version)"
            echo "  TypeScript: $(tsc --version)"
            echo "  Zellij: $(zellij --version)"
            echo ""
            
            # Install dependencies if needed
            if [ ! -d "node_modules" ]; then
              echo "📦 Installing dependencies..."
              bun install
            fi
            
            # Set up environment variables
            export OPENCODE_DEV=1
            export NODE_ENV=development
          '';
          
          # Environment variables
          OPENCODE_PLUGIN_DEV = "true";
        };

        # Run the full test suite with `nix check` or `nix build .#checks.<system>.default`
        checks.default = pkgs.stdenv.mkDerivation {
          name = "openzellij-tests";
          src = ./.;

          nativeBuildInputs = with pkgs; [ nodejs_22 ];

          # Allow network access for `npm ci` — this check is intended for
          # developer use and CI environments that have outbound internet.
          __noChroot = true;

          buildPhase = ''
            export HOME=$(mktemp -d)
            export npm_config_cache=$(mktemp -d)
            npm ci
            npm test
          '';

          installPhase = ''
            mkdir -p $out
            echo "Tests passed" > $out/result
          '';
        };
        
        # Package definition (optional - for installing the plugin)
        packages.default = pkgs.buildNpmPackage {
          pname = "openzellij";
          version = "1.0.0";
          
          src = ./.;
          
          npmDepsHash = pkgs.lib.fakeSha256;
          
          buildPhase = ''
            bun run build
          '';
          
          installPhase = ''
            mkdir -p $out
            cp -r dist $out/
            cp package.json $out/
          '';
        };
      }
    );
}
