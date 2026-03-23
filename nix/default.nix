{ lib, buildNpmPackage }:

buildNpmPackage {
  pname = "openzellij";
  version = "1.0.0";

  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.gitTracked ../.;
  };

  npmDepsHash = "sha256-+hMsrbsppbU8sUnQR2mT/vgerP8l4BYfdnr3NgWrWjg=";

  npmBuildScript = "build";

  installPhase = ''
    mkdir -p $out
    cp -r dist/* $out/
  '';

  meta = with lib; {
    description = "OpenCode plugin for Zellij integration";
    license = licenses.mit;
    homepage = "https://github.com/your-org/openzellij";
  };
}
