import {
    Texture,
    TextureLoader,
    RepeatWrapping
} from "three";

const textureLoader =
    new TextureLoader();

export function loadFloorTexture(
    url: string,
    repeatX = 4,
    repeatY = 4
): Texture {

    const texture =
        textureLoader.load(url);

    texture.wrapS =
        RepeatWrapping;

    texture.wrapT =
        RepeatWrapping;

    texture.repeat.set(
        repeatX,
        repeatY
    );

    return texture;
}