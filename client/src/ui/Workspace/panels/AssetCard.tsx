import "./AssetCard.css";

interface Asset {

    id: string;

    name: string;

    thumbnail: string;

    model: string;

}

interface Props {

    asset: Asset;

}

export default function AssetCard({

    asset

}: Props) {

    return (

        <button className="asset-card">

            <img

                src={asset.thumbnail}

                alt={asset.name}

            />

            <span>

                {asset.name}

            </span>

        </button>

    );

}