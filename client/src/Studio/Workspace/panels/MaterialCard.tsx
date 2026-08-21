import "./MaterialCard.css";

import type { Material } from "../../../engine/materials/MaterialTypes";

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

    return (
        <button
            type="button"
            className={`material-card ${
                selected ? "selected" : ""
            }`}
            onClick={onClick}
            aria-pressed={selected}
        >

            <div className="material-card-thumbnail">

                {material.thumbnail ? (
                    <img
                        src={material.thumbnail}
                        alt={material.name}
                    />
                ) : (
                    <div className="material-card-placeholder" />
                )}

            </div>

            <div className="material-card-name">
                {material.name}
            </div>

            <div className="material-card-price">
                ₱{material.pricePerSquareMeter.toLocaleString()}
                <span>/m²</span>
            </div>

        </button>
    );
}