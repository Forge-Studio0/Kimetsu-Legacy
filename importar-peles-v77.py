"""Converte as faces externas das peles fornecidas em atlases Bedrock de 128 px."""

from argparse import ArgumentParser
from base64 import b64decode
from io import BytesIO
from json import loads
from pathlib import Path
from zipfile import ZipFile

from PIL import Image


# O anexo usa superfícies de Blockbench olhando para -X. O atlas do
# jogador olha para -Z. As faces abaixo já estão na direção do jogador.
PARTES = {
    # Origem no atlas vanilla de 64 px, tamanho do cubo e faces no modelo.
    "cabeca": ((0, 0), (8, 8, 8), {
        "north": (24, "west"), "south": (23, "east"),
        "west": (26, "south"), "east": (25, "north"),
        "up": (21, "up"), "down": (22, "down"),
    }),
    "tronco": ((16, 16), (8, 12, 4), {
        "north": (5, "west"), "south": (8, "east"),
        "west": (14, "south"), "east": (15, "north"),
    }),
    "braco_direito": ((40, 16), (4, 12, 4), {
        "north": (11, "west"), "south": (9, "east"),
        "west": (10, "south"), "east": (14, "north"),
        "up": (19, "up"), "down": (18, "down"),
    }),
    "braco_esquerdo": ((32, 48), (4, 12, 4), {
        "north": (12, "west"), "south": (7, "east"),
        "west": (15, "south"), "east": (13, "north"),
        "up": (20, "up"), "down": (17, "down"),
    }),
    "perna_direita": ((0, 16), (4, 12, 4), {
        "north": (0, "west"), "south": (2, "east"),
        "west": (6, "south"), "east": (6, "north"),
    }),
    "perna_esquerda": ((16, 48), (4, 12, 4), {
        "north": (1, "west"), "south": (3, "east"),
        "west": (4, "south"), "east": (4, "north"),
    }),
}
TONS = {
    "e8b98f": ("Pele_cor_E8B98F", "Pele_Masculina_1_E8B98F-2"),
    "c98f65": ("Pele_cor_C98F65-1", "Pele_Masculina_2_C98F65-2"),
    "a66b45": ("Pele_cor_A66B45", "Pele_Masculina_3_A66B45-1"),
    "75452f": ("Pele_cor_75452F-1", "Pele_Masculina_4_75452F-1"),
    "4a2c20": ("Pele_cor_4A2C20-1", "Pele_Masculina_5_4A2C20-1"),
}
ESCALA = 2
SAIDA = Path(__file__).parent / "codigo-v70/Kimetsu Fix Re/textures/entity/customizacao/peles"


def faces_atlas(origem, dimensoes):
    x, y = origem
    largura, altura, fundo = dimensoes
    return {
        "west": (x, y + fundo, fundo, altura),
        "north": (x + fundo, y + fundo, largura, altura),
        "east": (x + fundo + largura, y + fundo, fundo, altura),
        "south": (x + 2 * fundo + largura, y + fundo, largura, altura),
        "up": (x + fundo, y, largura, fundo),
        "down": (x + fundo + largura, y, largura, fundo),
    }


def textura_do_modelo(modelo):
    textura = modelo["textures"][0]
    cabecalho, dados = textura["source"].split(",", 1)
    if cabecalho != "data:image/png;base64":
        raise ValueError("A textura de origem precisa ser um PNG incorporado.")
    with Image.open(BytesIO(b64decode(dados, validate=True))) as imagem:
        imagem = imagem.convert("RGBA")
    return imagem, (imagem.width / textura["uv_width"], imagem.height / textura["uv_height"])


def recortar(imagem, escala, modelo, indice, face):
    elemento = modelo["elements"][indice]
    u = elemento["faces"][face]
    if elemento["type"] != "cube" or u["texture"] != 0 or u.get("rotation", 0):
        raise ValueError(f"Face incompatível no elemento {indice} do Blockbench.")
    caixa = tuple(round(v * escala[i % 2]) for i, v in enumerate(u["uv"]))
    if caixa[0] >= caixa[2] or caixa[1] >= caixa[3]:
        raise ValueError(f"Face sem textura no elemento {indice}.")
    return imagem.crop(caixa)


def montar(modelo, tom):
    imagem, escala = textura_do_modelo(modelo)
    atlas = Image.new("RGBA", (64 * ESCALA, 64 * ESCALA))
    cor = "#" + tom
    solas = recortar(imagem, escala, modelo, 16, "down").transpose(Image.Transpose.ROTATE_270)
    for parte, (origem, dimensoes, faces) in PARTES.items():
        for face, (x, y, largura, altura) in faces_atlas(origem, dimensoes).items():
            tamanho = largura * ESCALA, altura * ESCALA
            amostra = Image.new("RGBA", tamanho, cor)
            if face in faces:
                detalhe = recortar(imagem, escala, modelo, *faces[face])
                if face in ("up", "down"):
                    detalhe = detalhe.transpose(Image.Transpose.ROTATE_270)
                amostra.alpha_composite(detalhe.resize(tamanho, Image.Resampling.NEAREST))
            elif parte.startswith("perna") and face == "down":
                meio = solas.width // 2
                x_sola = 0 if parte == "perna_direita" else meio
                detalhe = solas.crop((x_sola, 0, x_sola + meio, solas.height))
                amostra.alpha_composite(detalhe.resize(tamanho, Image.Resampling.NEAREST))
            atlas.paste(amostra, (x * ESCALA, y * ESCALA))
    return atlas


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("zip", type=Path, help="ZIP peles (1).zip")
    origem = parser.parse_args().zip
    SAIDA.mkdir(parents=True, exist_ok=True)
    with ZipFile(origem) as pacote:
        for tom, nomes in TONS.items():
            for base, nome in zip("ab", nomes):
                modelo = loads(pacote.read(f"peles/{nome}.bbmodel"))
                atlas = montar(modelo, tom)
                atlas.save(SAIDA / f"pele_{base}_{tom}.png", optimize=True)
    print("Dez peles de corpo inteiro convertidas.")


if __name__ == "__main__":
    main()
