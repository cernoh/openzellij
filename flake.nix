{
  description = "OpenCode plugin for Zellij integration";

  inputs.nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }: let
    systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
  in
  {
    packages = builtins.listToAttrs (map (system: {
      name = system;
      value = let pkgs = nixpkgs.legacyPackages.${system}; in {
        default = pkgs.callPackage ./nix/default.nix {};
      };
    }) systems);

    devShells = builtins.listToAttrs (map (system: {
      name = system;
      value = let pkgs = nixpkgs.legacyPackages.${system}; in {
        default = pkgs.mkShell {
          packages = with pkgs; [ nodejs_22 nodePackages.typescript ];
          shellHook = ''
            echo "openzellij dev environment"
            echo "Run: npm install && npm run build"
          '';
        };
      };
    }) systems);

    homeManagerModules.default = { config, lib, pkgs, ... }: {
      options.programs.openzellij = {
        enable = lib.mkEnableOption "openzellij - OpenCode plugin for Zellij integration";

        package = lib.mkOption {
          type = lib.types.package;
          default = self.packages.${pkgs.system}.default;
          description = "The openzellij package to use";
        };

        settings = lib.mkOption {
          type = lib.types.attrs;
          default = {};
          example = lib.literalExpression ''
            {
              autoClosePanes = true;
              panePollIntervalMs = 2000;
              paneMissingGraceMs = 6000;
              paneLayout = "tiled";
              enableLogging = true;
            }
          '';
          description = "Configuration for openzellij";
        };
      };

      config = lib.mkIf config.programs.openzellij.enable {
        home.packages = [ config.programs.openzellij.package ];

        home.file.".config/opencode/openzellij.json" = lib.mkIf (config.programs.openzellij.settings != {}) {
          text = builtins.toJSON config.programs.openzellij.settings;
        };
      };
    };
  };
}
