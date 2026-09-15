import {
  useMemo,
} from "react";

import {
  useGLTF,
} from "@react-three/drei";

import * as THREE from "three";

const CURTAIN_MODEL =
  "/models/curtainsV4.glb";

const TV_MODEL =
  "/models/TV.glb";

const CABINET_MODEL =
  "/models/Cabinet.glb";

const TRANSPARENT_OPACITY =
  0.6;

const SAVED_CURTAIN = {
  model: "curtainsV4.glb",

  position: [
    0.36381508186794065,
    1.8000000000000003,
    -2.480325287135881,
  ] as [
    number,
    number,
    number
  ],

  rotation: [
    0,
    0,
    0,
  ] as [
    number,
    number,
    number
  ],

  scale: [
    1,
    1,
    1,
  ] as [
    number,
    number,
    number
  ],
};

const SAVED_TV = {
  model: "TV.glb",

  position: [
    -1.0306140071150516,
    1.08,
    -0.18208562992245714,
  ] as [
    number,
    number,
    number
  ],

  rotation: [
    0,
    7.853981633974479,
    0,
  ] as [
    number,
    number,
    number
  ],

  scale: [
    0.7,
    0.7,
    0.7,
  ] as [
    number,
    number,
    number
  ],
};

const SAVED_CABINET = {
  model: "Cabinet.glb",

  position: [
    -0.8056224435930731,
    0.182,
    -0.30279023544309247,
  ] as [
    number,
    number,
    number
  ],

  rotation: [
    0,
    10.995574287564279,
    0,
  ] as [
    number,
    number,
    number
  ],

  scale: [
    1,
    1,
    1,
  ] as [
    number,
    number,
    number
  ],
};

function GLBModel({
  modelPath,
  position,
  rotation = [
    0,
    0,
    0,
  ],
  scale = [
    1,
    1,
    1,
  ],
  transparent = false,
}: {
  modelPath: string;

  position: [
    number,
    number,
    number
  ];

  rotation?: [
    number,
    number,
    number
  ];

  scale?: [
    number,
    number,
    number
  ];

  transparent?: boolean;
}) {
  const {
    scene,
  } = useGLTF(
    modelPath
  );

  const clonedScene =
    useMemo(() => {
      const clone =
        scene.clone();

      clone.traverse(
        (object) => {
          if (
            object instanceof
            THREE.Mesh
          ) {
            object.castShadow =
              true;

            object.receiveShadow =
              true;

            if (
              transparent
            ) {
              const applyTransparency =
                (
                  material: THREE.Material
                ) => {
                  const cloned =
                    material.clone();

                  cloned.transparent =
                    true;

                  cloned.opacity =
                    TRANSPARENT_OPACITY;

                  cloned.depthWrite =
                    false;

                  return cloned;
                };

              if (
                Array.isArray(
                  object.material
                )
              ) {
                object.material =
                  object.material.map(
                    applyTransparency
                  );
              } else if (
                object.material
              ) {
                object.material =
                  applyTransparency(
                    object.material
                  );
              }
            }
          }
        }
      );

      return clone;
    }, [
      scene,
      transparent,
    ]);

  return (
    <primitive
      object={clonedScene}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}

useGLTF.preload(
  CURTAIN_MODEL
);

useGLTF.preload(
  TV_MODEL
);

useGLTF.preload(
  CABINET_MODEL
);

function CurtainModel() {
  return (
    <GLBModel
      modelPath={
        CURTAIN_MODEL
      }
      position={
        SAVED_CURTAIN.position
      }
      rotation={
        SAVED_CURTAIN.rotation
      }
      scale={
        SAVED_CURTAIN.scale
      }
      transparent={
        false
      }
    />
  );
}

function TVModel() {
  return (
    <GLBModel
      modelPath={TV_MODEL}
      position={
        SAVED_TV.position
      }
      rotation={
        SAVED_TV.rotation
      }
      scale={
        SAVED_TV.scale
      }
      transparent
    />
  );
}

function CabinetModel() {
  return (
    <GLBModel
      modelPath={
        CABINET_MODEL
      }
      position={
        SAVED_CABINET.position
      }
      rotation={
        SAVED_CABINET.rotation
      }
      scale={
        SAVED_CABINET.scale
      }
      transparent
    />
  );
}

export default function PreviewEnvironment() {
  return (
    <>
      <CurtainModel />

      <TVModel />

      <CabinetModel />
    </>
  );
}