#!/usr/bin/env python3

import argparse
import sys
from bs4 import BeautifulSoup, SoupStrainer


def convert_map_to_svg(file_path: str) -> str:
    """Convert image map areas to SVG shapes."""
    try:
        if not file_path.endswith((".map", ".html")):
            print("File should be .map or .html.")
            sys.exit(1)
        with open(file_path, "r") as file:
            soup = BeautifulSoup(
                file, "html.parser", parse_only=SoupStrainer(["img", "map"])
            )
        return generate_svg(soup)
    except FileNotFoundError:
        print(f"File not found: {file_path}")
        sys.exit(1)
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)


def get_svg_shape(area) -> str:
    """Given an <area> shape, get the equivalent SVG shape."""
    map_shape_to_svg = {
        "poly": "polygon",
        "rect": "rect",
        "circle": "circle",
    }
    return map_shape_to_svg[area]


def get_coordinate_attrs(points: str, shape: str) -> str:
    """Convert <area> coordinates to SVG coordinates."""
    if shape == "circle":
        point_list = points.split(",")
        # <area> coords format is x,y,radius.
        return 'cx="{}" cy="{}" r="{}"'.format(*point_list)

    elif shape == "rect":
        # <area> coordinate format is x1,y1,x2,y2, coordinates for top-left and
        # bottom-right of the rectangle.
        coords = [int(p) for p in points.split(",")]

        # Get the width and height based on the two X coordinates. Use the
        # absolute value because some image map generators seem to incorrectly
        # put the bottom-right coordinate first.

        # Width is x2 - x1.
        width = abs(coords[2] - coords[0])

        # Height is y2 - y1.
        height = abs(coords[3] - coords[1])

        # (x,y) is the coordinate of the top-left corner. Use the minimum value
        # in case the image map generator put the bottom-right corner first.
        x = min(coords[0], coords[2])
        y = min(coords[1], coords[3])

        # rect's x and y attributes are the coordinates of the top left corner.
        attrs = f'x="{x}" y="{y}" width="{width}" height="{height}"'
        return attrs

    else:
        # The shape is a polygon.
        return f'points="{points}"'


def generate_svg(soup) -> str:
    """Build the SVG string."""
    soup.img["style"] = "max-width:100%;height:auto"
    del soup.img["usemap"]

    img_width = soup.img.get("width")
    img_height = soup.img.get("height")

    if not img_width or not img_height:
        print(
            "Cannot determine image dimensions. Does <img> have both a width and height?"
        )
        print(f"Image:\n\t{soup.img}")
        sys.exit(1)

    svg_string = f"""
<div style="position:relative;display:inline-block">
    {soup.img}
    <svg
        viewBox="0 0 {img_width} {img_height}"
        xmlns="http://www.w3.org/2000/svg"
        version="1.1"
        style="position:absolute;top:0;left:0"
    >
    """
    svg_string = (
        svg_string
        + """
    <defs>
        <style type="text/css"><![CDATA[
            .fill {
                fill: none;
                pointer-events: visible;
                transform-origin: center;
                transform-box: fill-box;
                will-change: scale;
            }
            .stroke {
                fill: none;
                stroke: none;
            }
            .fill:hover {
                fill: #e8d71b99;
                animation: zoom-in-zoom-out 1s ease infinite;
            }
            .fill:hover + .stroke, .stroke.stroke--visible {
                stroke: red;
                stroke-width: 2px;
            }
            @keyframes zoom-in-zoom-out {
                0% {
                    transform: scale(1, 1);
                }
                50% {
                    transform: scale(1.1, 1.1);
                }
                100% {
                    transform: scale(1, 1);
                }
            }
        ]]></style>
    </defs>
    <filter id="blur">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
    </filter>
    """
    )

    # Generate regions.
    areas = soup.map.findAll("area")
    for area in areas:
        shape = get_svg_shape(area.get("shape"))
        points = get_coordinate_attrs(area.get("coords"), shape)

        # `fill` is the inner region of the shape.
        region_string = f'<{shape} {points} filter="url(#blur)" class="fill" />'

        # `stroke` is the outline of the shape. This is separate to maintain
        # a sharp stroke while blurring the fill.
        if not args.no_strokes:
            classes = "stroke"
            if args.visible_strokes:
                classes = classes + " stroke--visible"
            stroke_string = (
                f'<{shape} {points} class="{classes}" stroke-linejoin="round" />'
            )
            region_string = f"{region_string}{stroke_string}"

        href = area.get("href")
        if href:
            # Hyperlink the shape.
            alt_text = area.get("alt")
            target = area.get("target", "_self")
            region_string = f'<a href="{href}" alt="{alt_text}" target="{target}">{region_string}</a>'

        svg_string = svg_string + region_string

    # Close out the open elements.
    return svg_string + "</svg></div>"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert an HTML image map to SVG shapes."
    )
    parser.add_argument(
        "file", type=str, help="The image map file, either .map or .html."
    )
    parser.add_argument(
        "--no-strokes",
        action="store_true",
        help="Don't show an outline around the shapes.",
    )
    parser.add_argument(
        "--visible-strokes",
        action="store_true",
        help="Always show strokes, otherwise they are only visible on hover. Ignored if --no-strokes is enabled.",
    )

    args = parser.parse_args()
    svg = convert_map_to_svg(args.file)
    print("\n")
    print(BeautifulSoup(svg, "html.parser").prettify(formatter="minimal"))
