import "./MaterialCard.css";

import {
    useState
} from "react";

import type {
    Material
} from "../../../engine/materials/MaterialTypes";

interface Props {

    material: Material;

    selected: boolean;

    onClick: () => void;
}

export default function MaterialCard({
    material,
    selected,
    onClick
}: Props) {

    const [
        imageFailed,
        setImageFailed
    ] = useState(false);

    const showImage =
        Boolean(
            material.thumbnail
        ) &&
        !imageFailed;

    return (

        <button

            type="button"

            className={
                `material-card ${
                    selected
                        ? "selected"
                        : ""
                }`
            }

            onClick={
                onClick
            }

            aria-pressed={
                selected
            }

        >

            <div
                className="material-card-thumbnail"
            >

                {showImage ? (

                    <img

                        src={
                            material.thumbnail
                        }

                        alt={
                            material.name
                        }

                        onError={() =>
                            setImageFailed(
                                true
                            )
                        }

                    />

                ) : material.color ? (

                    <div

                        className="material-card-color"

                        style={{
                            backgroundColor:
                                material.color
                        }}

                        aria-label={
                            `${material.name} color`
                        }

                    />

                ) : (

                    <div
                        className="material-card-placeholder"
                    />

                )}

            </div>

            <div
                className="material-card-name"
            >
                {
                    material.name
                }
            </div>

            <div
                className="material-card-price"
            >

                ₱
                {
                    Number(
                        material.pricePerSquareMeter
                    ).toLocaleString()
                }

                <span>
                    /m²
                </span>

            </div>

        </button>
    );
}