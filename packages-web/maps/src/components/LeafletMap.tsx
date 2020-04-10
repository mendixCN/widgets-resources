import { createElement, ReactElement, useEffect, useRef } from "react";
import {
    FeatureGroup,
    LatLngLiteral,
    Map,
    MapOptions,
    Marker as LeafletMarker,
    icon,
    tileLayer,
    TileLayerOptions,
    TileLayer
} from "leaflet";
import { MapProviderEnum, Marker, SharedProps } from "../../typings";
import classNames from "classnames";
import { customUrls, getDimensions, mapAttr } from "../utils";

export interface LeafletProps extends SharedProps {
    mapProvider: MapProviderEnum;
    attributionControl: boolean;
}

export const LeafletMap = (props: LeafletProps): ReactElement => {
    const map = useRef<Map>();
    const leafletRef = useRef<HTMLDivElement>(null);
    const defaultCenterLocation: LatLngLiteral = { lat: 51.906688, lng: 4.48837 };
    const markerGroup = useRef<FeatureGroup>(new FeatureGroup());

    useEffect(() => {
        createMap();

        return () => {
            if (map.current) {
                map.current.off();
                map.current.remove();
            }
        };
    }, []);

    useEffect(() => {
        addMarkers();
    }, [props.locations, props.currentLocation]);

    const createMap = (): void => {
        const mapOptions: MapOptions = {
            scrollWheelZoom: props.optionScroll,
            zoomControl: props.optionZoomControl,
            attributionControl: props.attributionControl,
            zoom: props.zoomLevel,
            minZoom: 1,
            maxZoom: 18, // Max zoom for HERE, OSM & MapBox
            dragging: props.optionDrag,
            center: defaultCenterLocation,
            closePopupOnClick: false
        };
        if (leafletRef.current && !map.current) {
            map.current = new Map(leafletRef.current, mapOptions)
                .addLayer(baseMapLayer())
                .addLayer(markerGroup.current);
        }
        addMarkers();
    };

    const addMarkers = (): void => {
        markerGroup.current.clearLayers();
        if (props.locations && props.locations.length) {
            props.locations.forEach(location => {
                markerGroup.current.addLayer(addMarker(location));
            });
        }
        addCurrentLocation();
        updateCamera();
    };

    const addMarker = (marker: Marker): LeafletMarker => {
        const mapMarker = new LeafletMarker([Number(marker.latitude), Number(marker.longitude)], {
            title: marker.title,
            alt: marker.title
        });
        if (marker.title) {
            mapMarker.setTooltipContent(marker.title);
            if (marker.onClick) {
                const infoContent = document.createElement("span");
                infoContent.innerHTML = marker.title || "";
                infoContent.style.cursor = "pointer";
                infoContent.onclick = marker.onClick;
                mapMarker.bindPopup(infoContent).openPopup();
            } else {
                mapMarker.bindPopup(marker.title).openPopup();
            }
        } else {
            if (marker.onClick) {
                mapMarker.on("click", () => {
                    marker.onClick!();
                });
            }
        }
        if (marker.url) {
            mapMarker.setIcon(
                icon({
                    iconUrl: marker.url,
                    iconSize: [32, 32],
                    className: "marker"
                })
            );
        }
        return mapMarker;
    };

    const updateCamera = (): void => {
        const { zoomLevel, autoZoom } = props;
        if (map.current) {
            const bounds = markerGroup.current.getBounds();
            try {
                if (bounds.isValid()) {
                    map.current.fitBounds(bounds, { animate: false }).invalidateSize();
                }
                if (!autoZoom) {
                    map.current.panTo(getCenter(), { animate: false });
                    map.current.setZoom(zoomLevel);
                }
            } catch (error) {
                console.error(`Invalid map bounds ${error.message}`);
            }
        }
    };

    const getCenter = (): LatLngLiteral => ({
        lat: props.locations?.[0]?.latitude ?? defaultCenterLocation.lat,
        lng: props.locations?.[0]?.longitude ?? defaultCenterLocation.lng
    });

    const addCurrentLocation = (): void => {
        if (map.current && props.currentLocation) {
            const currentLocationMarker = addMarker(props.currentLocation);
            if (currentLocationMarker) {
                const layer = markerGroup.current.addLayer(currentLocationMarker);
                map.current.addLayer(layer);
            }
        }
    };

    const baseMapLayer = (): TileLayer => {
        const { mapProvider, mapsToken } = props;

        let urlTemplate;
        let mapAttribution;
        if (mapProvider === "mapBox") {
            urlTemplate = customUrls.mapbox + mapsToken;
            mapAttribution = mapAttr.mapboxAttr;
        } else if (mapProvider === "hereMaps" && mapsToken && mapsToken.indexOf(",") > 0) {
            const splitToken = mapsToken.split(",");
            urlTemplate = customUrls.hereMaps + `app_id=${splitToken[0]}&app_code=${splitToken[1]}`;
            mapAttribution = mapAttr.hereMapsAttr;
        } else {
            urlTemplate = customUrls.openStreetMap;
            mapAttribution = mapAttr.openStreetMapAttr;
        }

        return tileLayer(urlTemplate, {
            attribution: mapAttribution,
            id: mapProvider === "mapBox" ? "mapbox.streets" : undefined
        } as TileLayerOptions);
    };

    return (
        <div className={classNames("widget-maps", props.className)} style={{ ...props.style, ...getDimensions(props) }}>
            <div className="widget-leaflet-maps-wrapper">
                <div className="widget-leaflet-maps" ref={leafletRef} />
            </div>
        </div>
    );
};
