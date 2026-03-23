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
          packages = with pkgs; [ nodejs_22 typescript vitest ];
          shellHook = ''
            echo "openzellij dev environment"
            echo "Run: npm install && npm run build"
          '';
        };
      };
    }) systems);
  };
}
