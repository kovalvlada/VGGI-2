class SurfaceModel {
    constructor(gl, uSteps = 40, vSteps = 100) {
        this.gl = gl;
        this.uSteps = uSteps;
        this.vSteps = vSteps;

        this.iVertexBuffer = gl.createBuffer();
        this.iNormalBuffer = gl.createBuffer();
        this.iTangentBuffer = gl.createBuffer();
        this.iTexCoordBuffer = gl.createBuffer();
        this.iIndexBuffer = gl.createBuffer();
        this.indexCount = 0;

        this.rebuild(uSteps, vSteps);
    }

    // Параметрична поверхня Cornucopia
    evaluateSurface(u, v) {
        const alpha = 0.1;
        const beta = 0.5;
        const expV = Math.exp(alpha * v);

        const x = expV * (Math.cos(v) + Math.cos(u) * Math.cos(v) - Math.sin(u) * Math.sin(v) * beta);
        const y = expV * (Math.sin(v) + Math.cos(u) * Math.sin(v) + Math.sin(u) * Math.cos(v) * beta);
        const z = expV * Math.sin(u);

        const scale = 0.65;
        return [x * scale, y * scale, z * scale];
    }

    // Обчислення нормованого дотичного вектора dP/du
    evaluateTangent(u, v) {
        const eps = 0.0001;
        const p1 = this.evaluateSurface(u, v);
        const p2 = this.evaluateSurface(u + eps, v);

        let tx = p2[0] - p1[0];
        let ty = p2[1] - p1[1];
        let tz = p2[2] - p1[2];

        const len = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (len > 0.000001) {
            tx /= len;
            ty /= len;
            tz /= len;
        } else {
            tx = 1.0; ty = 0.0; tz = 0.0;
        }
        return [tx, ty, tz];
    }

    // Перераховує геометрію, нормалі, дотичні та UV при зміні повзунків U/V
    rebuild(uSteps, vSteps) {
        this.uSteps = uSteps;
        this.vSteps = vSteps;

        const uMin = 0, uMax = 2 * Math.PI;
        const vMin = -3.0, vMax = 2.0;

        const vertices = [];
        const tangents = [];
        const texCoords = [];
        const indices = [];

        // Множники повторення текстури по U та V
        const uRepeat = 3.0;
        const vRepeat = 3.0;

        // 1. Генерація вершин, дотичних та UV для сітки (uSteps + 1) x (vSteps + 1)
        for (let i = 0; i <= this.uSteps; i++) {
            const uNorm = i / this.uSteps;
            const u = uMin + uNorm * (uMax - uMin);

            for (let j = 0; j <= this.vSteps; j++) {
                const vNorm = j / this.vSteps;
                const v = vMin + vNorm * (vMax - vMin);

                vertices.push(...this.evaluateSurface(u, v));
                tangents.push(...this.evaluateTangent(u, v));
                texCoords.push(uNorm * uRepeat, vNorm * vRepeat);
            }
        }

        // 2. Створення трикутників (індексування VBO)
        for (let i = 0; i < this.uSteps; i++) {
            for (let j = 0; j < this.vSteps; j++) {
                const p1 = i * (this.vSteps + 1) + j;
                const p2 = p1 + 1;
                const p3 = (i + 1) * (this.vSteps + 1) + j;
                const p4 = p3 + 1;

                indices.push(p1, p3, p2);
                indices.push(p2, p3, p4);
            }
        }

        // 3. Обчислення Середніх Фасетних Нормалей (Facet Average Normal)
        const normals = this.calculateFacetAverageNormals(vertices, indices);

        this.indexCount = indices.length;

        // 4. Завантаження даних у GPU VBO буфери
        const gl = this.gl;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tangents), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    }

    // Алгоритм розрахунку середньої фасетної нормалі
    calculateFacetAverageNormals(vertices, indices) {
        const normals = new Float32Array(vertices.length);

        for (let i = 0; i < indices.length; i += 3) {
            const idx0 = indices[i];
            const idx1 = indices[i + 1];
            const idx2 = indices[i + 2];

            const i0 = idx0 * 3;
            const i1 = idx1 * 3;
            const i2 = idx2 * 3;

            const p0 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
            const p1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
            const p2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

            const v1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            const v2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];

            const fn = [
                v1[1] * v2[2] - v1[2] * v2[1],
                v1[2] * v2[0] - v1[0] * v2[2],
                v1[0] * v2[1] - v1[1] * v2[0]
            ];

            for (const idx of [i0, i1, i2]) {
                normals[idx] += fn[0];
                normals[idx + 1] += fn[1];
                normals[idx + 2] += fn[2];
            }
        }

        for (let i = 0; i < normals.length; i += 3) {
            const nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (len > 0.00001) {
                normals[i] /= len;
                normals[i + 1] /= len;
                normals[i + 2] /= len;
            }
        }

        return normals;
    }

    Draw(shProg) {
        const gl = this.gl;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProg.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProg.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProg.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProg.iAttribNormal);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.vertexAttribPointer(shProg.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProg.iAttribTangent);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.vertexAttribPointer(shProg.iAttribTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProg.iAttribTexCoord);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    }
}