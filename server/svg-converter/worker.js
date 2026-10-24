export default
{
	async fetch(request, env)
	{
		if(request.method !== "POST") return new Response("Method Not Allowed", {status: 405} );

		try
		{
			const body = await request.json();
			const svg = body.svg;

			if(typeof svg !== "string" || !svg.trim()) return Response.json( {error: "svg is required"}, {status: 400} );

			const width = Number(body.width || 1024);
			const height = Number(body.height || 1024);
			const scale = Number(body.scale || 1);

			if(!Number.isFinite(width) || !Number.isFinite(height)) return Response.json( {error: "Invalid dimensions"}, {status: 400} );

			if(width < 1 || width > 4096) return Response.json( {error: "Invalid width"}, {status: 400} );
			if(height < 1 || height > 4096) return Response.json( {error: "Invalid height"}, { status: 400} );
			if(scale < 0.1 || scale > 4) return Response.json( {error: "Invalid scale"}, {status: 400} );

			validateSvg(svg);

			const html = `
				<!DOCTYPE html>
				<html>
					<head>
						<meta charset="UTF-8">
						<style>
							html, body
							{
								margin: 0;
								padding: 0;
								width: ${width}px;
								height: ${height}px;
								overflow: hidden;
								background: transparent;
							}

							body
							{
								display: flex;
								align-items: center;
								justify-content: center;
							}

							svg
							{
								display: block;
								width: ${width}px;
								height: ${height}px;
							}
						</style>
					</head>
					<body> ${svg} </body>
				</html>
			`;

			const pngResponse = await env.BROWSER.quickAction("screenshot",
			{
				html,
				viewport: {
					width,
					height,
					deviceScaleFactor: scale
				},
				screenshotOptions: {
					type: "png",
					omitBackground: true
				}
			});

			if(!pngResponse.ok) return Response.json( { error: "Browser Rendering failed", details: await pngResponse.text()}, {status: 500} );

			return new Response(
				await pngResponse.arrayBuffer(),
				{
					status: 200,

					headers: {
					"Content-Type": "image/png",
					"Cache-Control": "no-store"
					}
				}
			);

		}
		catch (error)
		{
			return Response.json( {error: error instanceof Error ? error.message : "Unknown error"}, {status: 500} );
		}
	}
};

function validateSvg(svg)
{
	const lower = svg.toLowerCase();
	const forbidden = [ "<script", "</script", "javascript:", "onload=", "onclick=", "onerror=", "onmouseover=", "<iframe", "<object", "<embed", "<foreignobject"];

	for(const value of forbidden)
		if(lower.includes(value)) throw new Error("Forbidden SVG content");
}