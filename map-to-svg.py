#!/usr/bin/env python3

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
        print(f"The file at {file_path} was not found.")
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
        "default": "polygon",
    }
    return map_shape_to_svg.get(area)


def get_coordinate_attrs(points: str, shape: str) -> str:
    """Convert <area> coordinates to SVG coordinates."""
    if shape == "polygon":
        return f'points="{points}"'

    points = points.split(",")

    if shape == "circle":
        # <area> coords format is x,y,radius.
        return 'cx="{}" cy="{}" r="{}"'.format(*points)

    if shape == "rect":
        # <area> coords format is x1,y1,x2,y2, coordinates for top-left and
        # bottom-right of the rectangle.
        points = [int(p) for p in points]

        # Width is x2 - x1.
        width = points[2] - points[0]

        # Height is y2 - y1.
        height = points[3] - points[1]

        # rect's x and y attributes are the coordinates of the top left corner.
        attrs = f'x="{points[0]}" y="{points[1]}" width="{width}" height="{height}"'
        return attrs


def generate_svg(soup) -> str:
    """Build the SVG string."""
    soup.img["style"] = "max-width:100%;height:auto"
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
    <defs>
        <style type="text/css"><![CDATA[
            .fill {{
                fill: none;
                pointer-events: visible;
                transform-origin: center;
                transform-box: fill-box;
            }}
            .stroke {{
                fill: none;
                stroke: none;
            }}
            .fill:hover {{
                fill: #e8d71b99;
                animation: zoom-in-zoom-out 1s ease infinite;
            }}
            .fill:hover + .stroke {{
                stroke: black;
                stroke-width: 2px;
            }}
            @keyframes zoom-in-zoom-out {{
                0% {{
                    transform: scale(1, 1);
                }}
                50% {{
                    transform: scale(1.1, 1.1);
                }}
                100% {{
                    transform: scale(1, 1);
                }}
            }}
        ]]></style>
    </defs>
    <filter id="blur">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
    </filter>
    """

    # Generate regions.
    areas = soup.map.findAll("area")
    for area in areas:
        shape = get_svg_shape(area.get("shape"))
        points = get_coordinate_attrs(area.get("coords"), shape)

        # `fill` is the inner region of the shape.
        fill_string = f'<{shape} {points} filter="url(#blur)" class="fill" />'

        # `stroke` is the outline of the shape. This is separate to maintain
        # a sharp stroke while blurring the fill.
        stroke_string = f'<{shape} {points} class="stroke" stroke-linejoin="round" />'
        region_string = f"{fill_string}{stroke_string}"

        if area.get("href"):
            # Hyperlink the shape.
            alt_text = area.get("alt")
            region_string = f'<a href="{area.get('href')}" alt="{alt_text}">{region_string}</a>'

        svg_string = svg_string + region_string

    # Close out the open elements.
    return svg_string + "</svg></div>"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 map-to-svg.py <file_path>")
    else:
        file_path = sys.argv[1]
        svg = convert_map_to_svg(file_path)
        print(BeautifulSoup(svg, "html.parser").prettify(formatter="minimal"))
