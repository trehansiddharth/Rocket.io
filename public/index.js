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
	var projid = parsed[parsed.length - 1];
	var hostid = parsed[2];
	
	socket = io.connect("http://" + hostid);
	
	socket.on('project-ready', function (url) {
		window.location.href = "http://" + hostid + url;
	});
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
