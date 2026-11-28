"""Gera as texturas e os modelos de mão dos dois itens da v86."""

from json import dumps
from pathlib import Path

from PIL import Image, ImageDraw


PACK = Path(__file__).resolve().parent / "codigo-v70/Kimetsu Fix Re"
TALISMA = "kny_talisma_eternidade"
PERGAMINHO = "kny_pergaminho_teleporte"
CONTORNO = "#21121c"
VINHO = "#431827"
VERMELHO = "#8e3540"
RUBI = "#c35752"
BRONZE = "#905338"
OURO = "#dfa657"
CLARO = "#ffe0a0"
PAPEL = "#eaca8d"
SEPIA = "#b98259"
TINTA = "#5e4540"
JADE = "#41938e"
LUZ = "#a0edde"


def tela():
    imagem = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    return imagem, ImageDraw.Draw(imagem)


def gravar_textura(imagem, grupo, nome):
    arquivo = PACK / "textures" / grupo / (nome + ".png")
    arquivo.parent.mkdir(parents=True, exist_ok=True)
    imagem.save(arquivo, optimize=True)


def gravar_json(nome, dados):
    arquivo = PACK / nome
    arquivo.parent.mkdir(parents=True, exist_ok=True)
    arquivo.write_text(dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def talisma_icone():
    imagem, d = tela()
    d.rectangle((16, 1, 20, 6), CONTORNO)
    d.rectangle((17, 2, 19, 4), OURO)
    d.point((17, 2), CLARO)
    d.polygon([(12, 3), (22, 5), (25, 8), (22, 25), (20, 27), (14, 27), (11, 30), (9, 30), (9, 28),
               (6, 29), (5, 27), (9, 24), (7, 22), (10, 6)], CONTORNO)
    d.polygon([(12, 5), (22, 6), (24, 8), (21, 24), (19, 26), (10, 24), (8, 21), (11, 7)], VERMELHO)
    d.line([(23, 8), (20, 23), (19, 25), (11, 23)], VINHO, 2)
    d.polygon([(13, 7), (21, 8), (22, 9), (19, 23), (10, 22), (11, 12)], OURO)
    d.polygon([(13, 8), (21, 9), (18, 22), (11, 21)], PAPEL)
    d.line([(13, 9), (19, 10)], CLARO)
    d.line([(12, 14), (12, 19), (15, 20)], CLARO)
    d.line([(15, 11), (18, 11), (16, 13), (18, 13)], TINTA)
    d.line([(14, 15), (13, 17), (14, 18), (15, 17), (17, 15), (19, 16),
            (18, 18), (17, 18), (15, 15), (14, 15)], VINHO)
    d.point((14, 17), RUBI)
    d.point((18, 16), RUBI)
    d.rectangle((15, 20, 17, 21), VERMELHO)
    d.point((16, 20), OURO)
    d.line([(8, 27), (12, 24)], RUBI, 2)
    d.line([(11, 28), (14, 25)], VERMELHO)
    d.line([(9, 23), (15, 25), (20, 25)], OURO)
    d.point((12, 24), CLARO)
    return imagem


def brilho(d, x, y, centro, borda):
    d.line([(x - 1, y), (x + 1, y)], borda)
    d.line([(x, y - 1), (x, y + 1)], borda)
    d.point((x, y), centro)


def pergaminho_icone():
    imagem, d = tela()
    d.polygon([(4, 10), (6, 8), (19, 5), (20, 3), (22, 2), (25, 3), (27, 8), (28, 16), (30, 22),
               (29, 25), (25, 26), (23, 24), (13, 27), (12, 29), (8, 29), (6, 27), (5, 21), (2, 13)], CONTORNO)
    d.polygon([(5, 11), (22, 6), (26, 22), (10, 27)], SEPIA)
    d.polygon([(5, 11), (21, 7), (24, 21), (10, 25)], PAPEL)
    d.line([(8, 12), (21, 9)], CLARO)
    d.line([(11, 24), (21, 21)], "#d5ab74")
    d.line([(8, 16), (12, 15), (12, 16)], "#b98b60")
    d.line([(18, 10), (21, 11), (20, 13)], "#b98b60")
    d.line([(12, 22), (10, 20), (12, 18), (14, 19), (15, 16), (18, 15), (19, 13)], JADE)
    d.line([(16, 13), (19, 12), (20, 15)], "#317e79")
    brilho(d, 11, 22, CLARO, JADE)
    d.polygon([(3, 13), (5, 11), (7, 12), (12, 26), (11, 28), (8, 28), (7, 26)], VERMELHO)
    d.line([(5, 13), (9, 25)], RUBI, 2)
    d.polygon([(3, 13), (5, 10), (7, 11), (8, 13), (5, 15)], BRONZE)
    d.line([(4, 13), (6, 11), (7, 12)], OURO)
    d.polygon([(7, 26), (10, 24), (12, 26), (11, 28), (8, 28)], OURO)
    d.line([(8, 26), (10, 25)], CLARO)
    d.polygon([(21, 6), (22, 4), (25, 4), (26, 7), (29, 22), (28, 24), (25, 25),
               (24, 23)], VINHO)
    d.line([(23, 7), (26, 22)], VERMELHO, 2)
    d.ellipse((21, 3, 25, 7), fill=OURO)
    d.point((22, 4), CLARO)
    d.polygon([(24, 22), (27, 21), (29, 22), (28, 24), (25, 24)], OURO)
    d.line([(25, 22), (27, 22)], CLARO)
    brilho(d, 16, 3, LUZ, JADE)
    brilho(d, 21, 27, LUZ, JADE)
    d.point((30, 16), LUZ)
    return imagem


def azulejo(d, u, v, largura, altura, fundo, claro, escuro):
    d.rectangle((u, v, u + largura - 1, v + altura - 1), fundo)
    d.line([(u, v + altura - 1), (u, v), (u + largura - 1, v)], claro)
    d.line([(u + 1, v + altura - 1), (u + largura - 1, v + altura - 1), (u + largura - 1, v + 1)], escuro)


def talisma_atlas():
    imagem, d = tela()
    for u in (0, 12):
        azulejo(d, u, 0, 10, 21, VERMELHO, RUBI, VINHO)
        azulejo(d, u + 1, 1, 8, 19, PAPEL, CLARO, BRONZE)
        d.line([(u + 3, 4), (u + 6, 4), (u + 4, 6), (u + 6, 6)], TINTA)
        d.line([(u + 3, 10), (u + 2, 12), (u + 3, 13), (u + 4, 12), (u + 6, 10), (u + 7, 11),
                (u + 6, 13), (u + 5, 12), (u + 4, 10), (u + 3, 10)], VINHO)
        d.rectangle((u + 3, 16, u + 6, 18), VERMELHO)
        d.point((u + 4, 17), CLARO)
    azulejo(d, 24, 0, 4, 4, VERMELHO, RUBI, VINHO)
    azulejo(d, 28, 0, 4, 4, OURO, CLARO, BRONZE)
    azulejo(d, 24, 4, 4, 4, PAPEL, CLARO, SEPIA)
    return imagem


def pergaminho_atlas():
    imagem, d = tela()
    for v in (0, 16):
        azulejo(d, 0, v, 19, 16, PAPEL, CLARO, SEPIA)
        d.line([(2, v + 2), (16, v + 2), (17, v + 3)], "#d9b47a")
        d.line([(5, v + 12), (7, v + 8), (10, v + 10), (13, v + 6), (15, v + 5)], JADE)
        d.line([(12, v + 4), (16, v + 4), (16, v + 8)], "#317e79")
        brilho(d, 5, v + 12, CLARO, JADE)
        d.line([(3, v + 5), (5, v + 5)], TINTA)
        d.rectangle((13, v + 11, 15, v + 13), VERMELHO)
        d.point((14, v + 12), CLARO)
    azulejo(d, 20, 0, 4, 8, VERMELHO, RUBI, VINHO)
    azulejo(d, 24, 0, 4, 4, OURO, CLARO, BRONZE)
    azulejo(d, 28, 0, 4, 4, PAPEL, CLARO, SEPIA)
    return imagem


def face(u, v, largura, altura):
    return {"uv": [u, v], "uv_size": [largura, altura]}


def cubo(origem, tamanho, frente, verso=None, lado=None):
    face_lateral = lado or frente
    return {
        "origin": origem,
        "size": tamanho,
        "uv": {f: face_lateral for f in ("east", "west", "up", "down")} |
        {"north": frente, "south": verso or frente},
    }


def talisma_cubos():
    ouro = face(28, 0, 4, 4)
    tecido = face(24, 0, 4, 4)
    papel = face(24, 4, 4, 4)
    return [
        cubo([-1.9, -0.6, -0.3], [3.8, 7.4, 0.6], face(0, 0, 10, 21), face(12, 0, 10, 21), papel),
        cubo([-2, 6.5, -0.42], [4, 0.48, 0.84], ouro),
        cubo([-2, -0.63, -0.43], [4, 0.42, 0.86], ouro),
        cubo([-0.65, 6.86, -0.3], [0.3, 1.03, 0.6], ouro),
        cubo([0.35, 6.86, -0.3], [0.3, 1.03, 0.6], ouro),
        cubo([-0.65, 7.75, -0.3], [1.3, 0.3, 0.6], ouro),
        cubo([-1.2, -2.05, -0.29], [0.48, 1.5, 0.58], tecido),
        cubo([-0.56, -1.56, -0.29], [0.46, 1.15, 0.58], tecido),
    ]


def pergaminho_cubos():
    ouro = face(24, 0, 4, 4)
    madeira = face(20, 0, 4, 8)
    papel = face(28, 0, 4, 4)
    cubos = [
        cubo([-3.7, -0.05, -0.25], [7.4, 4.7, 0.5], face(0, 0, 19, 16), face(0, 16, 19, 16), papel),
    ]
    for x in (-4.25, 3.25):
        cubos.extend([
            cubo([x, -0.35, -0.56], [1, 5.3, 1.12], madeira),
            cubo([x - 0.05, -0.6, -0.62], [1.1, 0.5, 1.24], ouro),
            cubo([x - 0.05, 4.68, -0.62], [1.1, 0.5, 1.24], ouro),
        ])
    return cubos


def gerar_item(nome, icone, atlas, cubos):
    gravar_textura(icone(), "icons", nome)
    gravar_textura(atlas(), "entity", nome)
    id_curto = nome.removeprefix("kny_")
    identificador = "kny:" + id_curto
    geometria = "geometry.kny." + id_curto
    gravar_json("models/entity/" + nome + ".geo.json", {
        "format_version": "1.16.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": geometria, "texture_width": 32, "texture_height": 32,
                "visible_bounds_width": 2, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.85, 0],
            },
            "bones": [{
                "name": "papel", "binding": "q.item_slot_to_bone_name(context.item_slot)",
                "pivot": [0, 0, 0], "cubes": cubos(),
            }],
        }],
    })
    gravar_json("attachables/" + nome + ".json", {
        "format_version": "1.20.30",
        "minecraft:attachable": {"description": {
            "identifier": identificador,
            "item": {identificador: "q.is_owner_identifier_any('minecraft:player')"},
            "materials": {"default": "entity_alphatest", "enchanted": "entity_alphatest_glint"},
            "textures": {
                "default": "textures/entity/" + nome, "enchanted": "textures/misc/enchanted_item_glint",
            },
            "geometry": {"default": geometria},
            "animations": {"segurar": "animation.kny.papeis_v86.segurar"},
            "scripts": {"animate": ["segurar"]},
            "render_controllers": ["controller.render.item_default"],
        }},
    })


if __name__ == "__main__":
    gerar_item(TALISMA, talisma_icone, talisma_atlas, talisma_cubos)
    gerar_item(PERGAMINHO, pergaminho_icone, pergaminho_atlas, pergaminho_cubos)
    gravar_json("animations/kny_papeis_v86.animation.json", {
        "format_version": "1.10.0",
        "animations": {"animation.kny.papeis_v86.segurar": {"loop": True, "bones": {
            "papel": {
                "position": [0, "c.is_first_person ? 18.0 : 21.0", "c.is_first_person ? 0.8 : -2.3"],
                "rotation": [
                    "c.is_first_person ? 28.0 : -18.0", "c.is_first_person ? -35.0 : -30.0",
                    "c.is_first_person ? -150.0 : -12.0",
                ],
            },
        }}},
    })
