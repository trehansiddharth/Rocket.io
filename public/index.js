$(document).ready(function ()
{
	var reader = new FileReader();
	$("#uploadlink").on('click', function (e)
	{
		document.getElementById('upload-dialog').click();
	});
	$("#upload-dialog").change(function (e) {
		handleFileUpload(reader, e.target.files);
	});
	$("#makeproject").click(function ()
	{
		if ($("#filename").val().indexOf(".") != -1)
		{
			socket.emit('make-project', $("#filename").val(), $("#cpfile").val());
		}
		else
		{
			alert("Your file name must be non-empty and specify an extension.");
		}
	});
	
	var url = $(location).attr('href');
	var parsed = $(location).attr('href').split('/');
	var hostid = parsed[2];
	
	socket = io.connect("http://" + hostid);
	
	socket.on('project-ready', function (url) {
		window.location.href = "http://" + hostid + url;
	});
    
    /*$.get("/user/query/login", function (data) {
        if (data == "TRUE")
        {
            $.get("/user/profile/me", function (str_profile) {
                if (str_profile.slice(0, 5) == "ERROR")
                {
                }
                else
                {
                    var profile = jQuery.parseJSON(str_profile);
                    //$("#top-right").html("<a target=\"_blank\" href=\"/u/me\" id=\"loginname\"><i class=\"glyphicon glyphicon-user\"></i> " + profile.displayName + "</a>");
                    $("#top-right").html("<a href=\"/logout\" id=\"loginname\"><i class=\"glyphicon glyphicon-user\"></i> " + profile.displayName + "</a>");
                    $("#loginname").click(function () {
                        
                    });
                }
            });
        }
        else
        {
            
        }
    });*/
});
function handleFileUpload(reader, files) // TODO: validate file
{
	var thisfile = null;
	reader.onload = function(e) {
		socket.emit('make-project', thisfile.name, e.target.result);	
	}
	thisfile = files[0];
	reader.readAsText(files[0]);
}
