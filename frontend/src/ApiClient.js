export default class ApiClient
{
	#baseUrl = null;
	#token = '';

	constructor(baseUrl) { this.#baseUrl = baseUrl; }

	#request(path, options)
	{
		return new Promise(resolve =>
		{
			let xhr = new XMLHttpRequest();
			xhr.responseType = 'json';
			xhr.timeout = 3000;

			xhr.open(options.method, `${this.#baseUrl}${path}`);

			let headers = {...(options.headers ?? {})};
			if(this.#token) headers['Authorization'] = `Bearer ${this.#token}`;
			for(let name in headers) xhr.setRequestHeader(name, headers[name]);

			xhr.onload = _ =>
			{
				if(xhr.status == 401) resolve({ok: false, error: 'Session expired. Reopen the game'});
				else if(xhr.status == 403) resolve({ok: false, error: xhr.response.error});
				else if(xhr.status == 409) resolve({ok: false, error: 'The word has changed. Reopen the game'});
				else if(xhr.status < 200 || xhr.status >= 300) resolve({ ok: false, error: `HTTP ${xhr.status}. ${xhr.response.error}` });
				else if(xhr.response === null) resolve({ ok: false, error: 'Returned data is not JSON.' });
				else resolve({ ok: true, data: xhr.response });
			};

			xhr.onerror = _ => resolve({ ok: false, error: 'Network error.' });
			xhr.ontimeout = _ => resolve({ ok: false, error: 'Timeout.' });
			xhr.onabort = _ => resolve({ ok: false, error: 'Aborted.' });

			xhr.send(options.body);
		});
	}

	#post(path, body = {})
	{
		let data = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			body: JSON.stringify({ ...body })
		}
		return this.#request(path, data);
	}

	#get(path)
	{
		let data = {
			method: 'GET',
			headers: { 'Accept': 'application/json' },
		}
		return this.#request(path, data);
	}

	async login(code, guildId = '')
	{
		let response = await this.#post('/login', {code, guildId});

		if(!response.ok || !response.data.access_token) throw new Error(`Token exchange failed. ${response.error}`);
		if(response.data.token) this.#token = response.data.token;
		else throw new Error('Server did not return a user id.');

		return response.data
	}

	guess(word, attempt) { return this.#post('/guess', { word }); }
	fetchResults(onlyYours) { return this.#post('/results', { onlyYours }); }
	exit(word) { return this.#post('/exit', { word }); }
}