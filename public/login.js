/*function signinCallback(authResult) {
	if (authResult['status']['signed_in']) {
		$.post('/login/googleplus', { code: authResult.code})
		$.post("https://accounts.google.com/o/oauth2/token", {
			
		});
		console.log(authResult);
	}
	else
	{
		console.log('There was an error: ' + authResult.error);
		// handle error
	}
}
(function() {
			var po = document.createElement('script'); po.type = 'text/javascript'; po.async = true;
			po.src = 'https://apis.google.com/js/client:plusone.js';
			var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(po, s);
		})();*/
$(document).ready(function ()
{
	/*$("#google").click(function () {
		$.get("https://accounts.google.com/o/oauth2/auth", {
			response_type : "code",
			client_id : CLIENT_ID,
			redirect_uri : "/login/googleplus",
			scope : "https://www.googleapis.com/auth/plus.login",
			state : "",
			access_type : "offline",
			approval_prompt : "force", // change to auto when not debugging
			login_hint : "",
			include_granted_scopes : true
		});
	});*/
});
function getCookie(cname)
{
	var name = cname + "=";
	var ca = document.cookie.split(';');
	for (var i = 0; i < ca.length; i++) 
	{
		var c = ca[i].trim();
		if (c.indexOf(name) == 0)
		{
			return c.substring(name.length, c.length);
		}
	}
	return "";
}
