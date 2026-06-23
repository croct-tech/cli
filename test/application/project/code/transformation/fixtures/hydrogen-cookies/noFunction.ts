const response = new Response();

response.headers.set('Set-Cookie', await hydrogenContext.session.commit());
