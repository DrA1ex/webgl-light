#version 300 es

uniform mat4 projection;
uniform vec2 light_pos;
uniform float light_radius;

in vec3 point;

void main() {
    vec2 out_point;
    if (point.z == 1.0) {
        out_point = normalize(point.xy - light_pos) * (light_radius * 1.2) + light_pos;
    } else {
        out_point = point.xy;
    }

    gl_Position = projection * vec4(out_point, 0., 1);
}