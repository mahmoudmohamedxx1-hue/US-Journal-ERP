"""Generate placeholder app icons for US Journal ERP."""
import struct, zlib, os

W = H = 256

def make_png(size, pixels_rgba):
    """Encode raw RGBA pixels as a PNG."""
    # PNG signature
    out = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk
    def chunk(name, data):
        chunk_data = name + data
        return struct.pack('>I', len(data)) + chunk_data + struct.pack('>I', zlib.crc32(chunk_data) & 0xFFFFFFFF)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    out += chunk(b'IHDR', ihdr)

    # Build raw image data with filter bytes
    raw = b''
    for y in range(size):
        raw += b'\x00'  # filter type: none
        for x in range(size):
            # Scale source coords
            sx = int(x * W / size)
            sy = int(y * H / size)
            offset = (sy * W + sx) * 4
            raw += pixels_rgba[offset:offset + 4]

    compressed = zlib.compress(raw, 9)
    out += chunk(b'IDAT', compressed)
    out += chunk(b'IEND', b'')
    return out


def make_ico(sizes, pngs_by_size):
    """Encode PNGs as a Windows ICO file."""
    # ICO header (6 bytes)
    out = struct.pack('<HHH', 0, 1, len(sizes))
    # Directory entries (16 bytes each)
    offset = 6 + 16 * len(sizes)
    for size in sizes:
        png = pngs_by_size[size]
        w = 0 if size == 256 else size
        h = 0 if size == 256 else size
        out += struct.pack('<BBBBHHII', w, h, 0, 0, 1, 32, len(png), offset)
        offset += len(png)
    # PNG data
    for size in sizes:
        out += pngs_by_size[size]
    return out


def main():
    os.makedirs('build/icons', exist_ok=True)

    # Create the source 256x256 image
    pixels = bytearray()
    for y in range(H):
        for x in range(W):
            # Navy background with teal UJ-style square in center
            if 60 < x < 196 and 60 < y < 196:
                # teal
                pixels.extend([20, 184, 166, 255])
            else:
                # navy
                pixels.extend([15, 23, 42, 255])

    # Generate PNGs in all required sizes
    sizes = [16, 32, 48, 64, 128, 256, 512, 1024]
    pngs = {}
    for size in sizes:
        png = make_png(size, bytes(pixels))
        pngs[size] = png
        path = f'build/icons/{size}x{size}.png'
        with open(path, 'wb') as f:
            f.write(png)
        print(f'  Created {path} ({len(png)} bytes)')

    # Create a 512x512 icon.png (Linux default)
    with open('build/icons/icon.png', 'wb') as f:
        f.write(pngs[512])
    print('  Created build/icons/icon.png')

    # Create Windows ICO file (multi-resolution)
    ico_sizes = [16, 32, 48, 64, 128, 256]
    ico = make_ico(ico_sizes, {s: pngs[s] for s in ico_sizes})
    with open('build/icon.ico', 'wb') as f:
        f.write(ico)
    print(f'  Created build/icon.ico ({len(ico)} bytes)')

    # Create macOS ICNS (simplified - PNG inside icns container)
    # icns header: 'icns' + total size (4 bytes)
    # Each icon: OSType (4 bytes) + length (4 bytes) + PNG data
    icns_data = b'icns'
    icon_entries = b''
    for size, ostype in [(16, b'icp4'), (32, b'icp5'), (48, b'icp6'), (128, b'ic07'), (256, b'ic08'), (512, b'ic09')]:
        png = pngs[size]
        icon_entries += ostype + struct.pack('>I', len(png) + 8) + png
    total_size = 4 + 4 + len(icon_entries)
    icns_data += struct.pack('>I', total_size) + icon_entries
    with open('build/icon.icns', 'wb') as f:
        f.write(icns_data)
    print(f'  Created build/icon.icns ({len(icns_data)} bytes)')

    print('\nAll icons created in build/')


if __name__ == '__main__':
    main()
