"""Monta os três arquivos da v86 a partir da base completa publicada e dos fontes."""

from argparse import ArgumentParser
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "codigo-v70"
BASE = ROOT / "Kimetsu_Fix_v85_Completo.mcaddon"
PACKS = {"Kimetsu Fix Be": "BP", "Kimetsu Fix Re": "RP"}
LEGACY_SPAWN = "Kimetsu Fix Be/spawn_rules/demon/"
OUTPUT = "Kimetsu_Fix_v86_"


def assemble():
    with ZipFile(BASE) as base:
        contents = {i.filename: base.read(i) for i in base.infolist() if not i.is_dir()}
    legacy = sorted(name for name in contents if name.startswith(LEGACY_SPAWN))
    if len(legacy) != 22:
        raise ValueError("A base v85 deve conter exatamente 22 regras antigas de Onis.")
    entries = {name: data for name, data in contents.items() if name not in legacy}
    for pack in PACKS:
        for file in (SOURCE / pack).rglob("*"):
            if file.is_file():
                name = file.relative_to(SOURCE).as_posix()
                if name.startswith(LEGACY_SPAWN):
                    raise ValueError(f"Uma regra antiga reapareceu nos fontes: {name}")
                entries[name] = file.read_bytes()
    for name in sorted(entries.keys() | contents.keys()):
        if entries.get(name) != contents.get(name):
            mark = "-" if name not in entries else "+" if name not in contents else "~"
            print(mark, name)
    return entries


def write(path, entries):
    with ZipFile(path, "x") as output:
        for name, data in sorted(entries.items()):
            info = ZipInfo(name)
            info.external_attr = 0o100644 << 16
            output.writestr(info, data, compress_type=ZIP_DEFLATED, compresslevel=9)
    with ZipFile(path) as output:
        if output.testzip() or set(output.namelist()) != entries.keys():
            raise ValueError(f"Arquivo inconsistente: {path.name}")
    print(path.name, len(entries))


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--saida", type=Path, default=ROOT)
    args = parser.parse_args()
    args.saida.mkdir(parents=True, exist_ok=True)
    entries = assemble()
    write(args.saida / (OUTPUT + "Completo.mcaddon"), entries)
    for pack, suffix in PACKS.items():
        prefix = pack + "/"
        write(args.saida / (OUTPUT + suffix + ".mcpack"), {
            name.removeprefix(prefix): data for name, data in entries.items() if name.startswith(prefix)
        })


if __name__ == "__main__":
    main()
