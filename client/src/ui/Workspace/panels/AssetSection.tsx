import "./AssetSection.css";

import { useState } from "react";

import { ChevronDown, ChevronRight } from "lucide-react";

import AssetCard from "./AssetCard";

interface Asset {

    id: string;

    name: string;

    thumbnail: string;

    model: string;

}

interface Props {

    title: string;

    assets: Asset[];

}

export default function AssetSection({

    title,

    assets

}: Props) {

    const [open, setOpen] = useState(false);

    return (

        <section className="asset-section">

            <button

                className="asset-section-header"

                onClick={() => setOpen(!open)}

            >

                <span>{title}</span>

                {

                    open

                        ? <ChevronDown size={18} />

                        : <ChevronRight size={18} />

                }

            </button>

            {

                open && (

                    <div className="asset-grid">

                        {

                            assets.map(asset => (

                                <AssetCard

                                    key={asset.id}

                                    asset={asset}

                                />

                            ))

                        }

                    </div>

                )

            }

        </section>

    );

}