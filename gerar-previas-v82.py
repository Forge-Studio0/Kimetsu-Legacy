"""Projeta os recursos da oficina no plano frontal do painel de aparência."""

from json import loads
from pathlib import Path

from PIL import Image


PACK = Path(__file__).parent / "codigo-v70/Kimetsu Fix Re"
TEXTURAS = PACK / "textures/entity/customizacao"
SAIDA = PACK / "textures/ui/customizacao/previa"
TAMANHO = (80, 156)
ESCALA = 4
CENTRO = 40
CHAO = 144
CORPO = [
    # Posição frontal, dimensões, UV de 64 px e rotação da pose.
    ((-4, 0, -2), (4, 12), (4, 20), -3),
    ((0, 0, -2), (4, 12), (20, 52), 3),
    ((-8, 12, -2), (4, 12), (44, 20), -6),
    ((4, 12, -2), (4, 12), (36, 52), 6),
    ((-4, 12, -2), (8, 12), (20, 20), 0),
    ((-4, 24, -4), (8, 8), (8, 8), 0),
]


def caixa_frontal(origem, tamanho):
    x, y, _ = origem
    w, h = tamanho
    return (
        round(CENTRO + x * ESCALA), round(CHAO - (y + h) * ESCALA),
        round(CENTRO + (x + w) * ESCALA), round(CHAO - y * ESCALA),
    )


def frente(textura, uv, tamanho_uv, caixa):
    u, v = uv
    w, h = tamanho_uv
    x, y, fim_x, fim_y = caixa
    return textura.crop((u, v, u + w, v + h)).resize((fim_x - x, fim_y - y), Image.Resampling.NEAREST)


def posicionar(figura, caixa, angulo):
    camada = Image.new("RGBA", TAMANHO)
    camada.paste(figura, caixa[:2])
    if angulo:
        x, y, fim_x, _ = caixa
        camada = camada.rotate(angulo, center=((x + fim_x) / 2, y + 2))
    return camada


def base_frontal(textura):
    resultado = Image.new("RGBA", TAMANHO)
    for origem, (w, h), (u, v), angulo in CORPO:
        caixa = caixa_frontal(origem, (w, h))
        figura = frente(textura, (2 * u, 2 * v), (2 * w, 2 * h), caixa)
        resultado.alpha_composite(posicionar(figura, caixa, angulo))
    return resultado


def profundidade_do_corpo():
    largura, altura = TAMANHO
    profundidade = [float("inf")] * (largura * altura)
    for origem, tamanho, _, angulo in CORPO:
        caixa = caixa_frontal(origem, tamanho)
        x, y, fim_x, fim_y = caixa
        figura = Image.new("RGBA", (fim_x - x, fim_y - y), "white")
        mascara = posicionar(figura, caixa, angulo).getchannel("A")
        for pos, alfa in enumerate(mascara.tobytes()):
            if alfa:
                profundidade[pos] = min(profundidade[pos], origem[2])
    return profundidade


def sobrepor(textura, cubos, fundo):
    resultado = Image.new("RGBA", TAMANHO)
    profundidade = fundo.copy()
    pixels = resultado.load()
    largura, altura = TAMANHO
    for cubo in sorted(cubos, key=lambda c: -c["origin"][2]):
        geometria = cubo["uv"].get("north")
        if not geometria:
            continue
        x, y, fim_x, fim_y = caixa_frontal(cubo["origin"], cubo["size"][:2])
        if fim_x <= x or fim_y <= y:
            continue
        amostra = frente(textura, geometria["uv"], geometria["uv_size"], (x, y, fim_x, fim_y)).load()
        z = cubo["origin"][2]
        for linha in range(max(0, y), min(altura, fim_y)):
            for coluna in range(max(0, x), min(largura, fim_x)):
                pos = linha * largura + coluna
                cor = amostra[coluna - x, linha - y]
                if cor[3] and z <= profundidade[pos]:
                    pixels[coluna, linha] = cor
                    profundidade[pos] = z
    return resultado, profundidade


def textura_em_rgba(caminho):
    with Image.open(caminho) as imagem:
        return imagem.convert("RGBA")


def salvar(imagem, grupo, id_):
    caixa = imagem.getbbox()
    if caixa is None or not (0 < caixa[0] < caixa[2] < TAMANHO[0] and 0 < caixa[1] < caixa[3] < TAMANHO[1]):
        raise ValueError(f"Prévia {grupo}/{id_} vazia ou sem margem no visor.")
    destino = SAIDA / grupo / (id_ + ".png")
    destino.parent.mkdir(parents=True, exist_ok=True)
    imagem.save(destino, optimize=True)


def main():
    modelos = loads((PACK / "models/entity/customizacao/oficina.geo.json").read_text())["minecraft:geometry"]
    cabecas = {
        modelo["description"]["identifier"].removeprefix("geometry.kny.cc_"):
            next(bone.get("cubes", []) for bone in modelo["bones"] if bone["name"] == "head")
        for modelo in modelos
    }
    fundo = profundidade_do_corpo()
    for caminho in sorted((TEXTURAS / "peles").glob("pele_*.png")):
        salvar(base_frontal(textura_em_rgba(caminho)), "pele", caminho.stem)

    for modelo in sorted(k for k in cabecas if k.startswith("cabelo_")):
        codigo = modelo.removeprefix("cabelo_")
        for caminho in sorted(TEXTURAS.glob("cabelo_*.png")):
            cor = caminho.stem.removeprefix("cabelo_")
            textura = textura_em_rgba(caminho)
            corte, profundidade = sobrepor(textura, cabecas[modelo], fundo)
            salvar(corte, "cabelo", f"{codigo}_{cor}")
            mecha, _ = sobrepor(textura, cabecas["mecha_" + codigo], profundidade)
            salvar(mecha, "mecha", f"{codigo}_{cor}")

    for modelo in sorted(k for k in cabecas if k.startswith("olho_")):
        _, lado, indice = modelo.split("_")
        codigo = int(indice) + 1
        for caminho in sorted(TEXTURAS.glob("iris_*.png")):
            cor = caminho.stem.removeprefix("iris_")
            olho, _ = sobrepor(textura_em_rgba(caminho), cabecas[modelo], fundo)
            salvar(olho, "olho", f"{lado}_{codigo}_{cor}")


if __name__ == "__main__":
    main()
