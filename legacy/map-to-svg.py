#!/usr/bin/env python3

import argparse
import sys
from bs4 import BeautifulSoup, SoupStrainer, Tag


def main(file_path: str) -> Tag:
    """Convert image map areas to SVG shapes."""

    try:
        if not file_path.endswith((".map", ".html")):
            print("File should be .map or .html.")
            sys.exit(1)
        with open(file_path, "r") as file:
            soup = BeautifulSoup(file, "lxml", parse_only=SoupStrainer(["img", "map"]))
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


def set_coordinate_attrs(element: Tag, points: str, shape: str):
    """Convert <area> coordinates to SVG coordinates."""

    if not points:
        print("Coordinates missing from element: ", element)
        sys.exit(1)

    if shape == "circle":
        # <area> coords format is x,y,radius.
        point_list = points.split(",")
        element.attrs = element.attrs | {
            "cx": point_list[0],
            "cy": point_list[1],
            "r": point_list[2],
        }

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
        # (leftmost and topmost) in case the image map generator put the
        # bottom-right corner first.
        x = min(coords[0], coords[2])
        y = min(coords[1], coords[3])

        # rect's x and y attributes are the coordinates of the top left corner.
        element.attrs = element.attrs | {
            "x": x,
            "y": y,
            "width": width,
            "height": height,
        }

    else:
        # The shape is a polygon. We can use the points directly.
        element["points"] = points


def build_fill_element(coords: str, shape: str) -> Tag:
    """Create an element for the shape fill."""

    fill = BeautifulSoup("lxml").new_tag(shape)
    fill["filter"] = "url(#blur)"
    fill["class"] = "fill"
    set_coordinate_attrs(fill, coords, shape)
    return fill


def build_stroke_element(coords: str, shape: str) -> Tag:
    """Create an element for the shape stroke."""

    classes = ["stroke"]
    if args.visible_strokes:
        classes.append("stroke--visible")

    stroke = BeautifulSoup("lxml").new_tag(
        shape,
        attrs={
            "class": classes,
            "stroke-linejoin": "round",
        },
    )
    set_coordinate_attrs(stroke, coords, shape)
    return stroke


def generate_svg(soup) -> Tag:
    """Build the SVG string."""

    # TODO: remove inline style.
    soup.img["style"] = "max-width:100%;height:auto"

    # There's no image map anymore!
    del soup.img["usemap"]

    img_width = soup.img.get("width")
    img_height = soup.img.get("height")

    if not img_width or not img_height:
        print(
            "Cannot determine image dimensions. Does <img> have both a width and height?"
        )
        print(f"Image:\n\t{soup.img}")
        sys.exit(1)

    # Create a div that will contain the original image and the SVG.
    wrapper = soup.new_tag("div")
    # TODO: remove inline style.
    wrapper["style"] = "position:relative;display:inline-block"
    wrapper.append(soup.img)

    # Now create the svg tag.
    svg = soup.new_tag("svg")
    svg.attrs = {
        # The viewbox needs to be the same dimensions as the image
        # in order to be responsive.
        "viewBox": f"0 0 {img_width} {img_height}",
        "xmlns": "http://www.w3.org/2000/svg",
        "version": "1.1",
        # This overlays the svg on the image.
        "style": "position:absolute;top:0;left:0",
    }
    wrapper.append(svg)

    # Insert some styles and filters.
    svg.append(
        BeautifulSoup(
            """
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
    </filter>""",
            "lxml",
        )
    )

    # Generate the regions from the image map areas.
    areas = soup.map.findAll("area")

    for area in areas:
        # The parent element may be either the svg or an <a> tag.
        parent = svg
        shape = get_svg_shape(area.get("shape"))
        href = area.get("href")

        if href:
            # Hyperlink the shape.
            link = soup.new_tag(
                "a",
                attrs={
                    "href": href,
                    "alt": area.get("alt"),
                    "target": area.get("target", "_self"),
                },
            )
            svg.append(link)

            # Make this link the parent element so it will wrap our shapes.
            parent = link

        # `fill` is the inner region of the shape.
        fill_element = build_fill_element(area.get("coords"), shape)
        parent.append(fill_element)

        if args.no_strokes:
            continue

        # `stroke` is the outline of the shape. This is separate to maintain
        # a sharp stroke while blurring the fill.
        stroke_element = build_stroke_element(area.get("coords"), shape)
        parent.append(stroke_element)

    return wrapper


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
    svg = main(args.file)
    print("\n")
    print(svg.prettify(formatter="minimal"))
