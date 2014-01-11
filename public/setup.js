$(document).ready(function ()
{
	var cuser = getCookie("username");
	if (cuser == "")
	{
		
	}
	else
	{
		$("#top-right").html("<span class=\"pointing\"><i class=\"glyphicon glyphicon-user\"></i> " + cuser.split("%20")[0] + "</span>");
	}
    $.get("/account/google/people", function (data) {
        if (data.slice(0, 5) == "ERROR")
        {
            $("#friends").empty();
            $("#friends").html("<td>An error occured. You are either not logged in or you have to refresh the page.</td>");
        }
        else
        {
            var people = jQuery.parseJSON(data);
            $("#friends").empty();
            for (i = 0; i < people.items.length; i++)
            {
                var person = people.items[i];
                if (person.objectType == 'person')
                {
                    var id = person.id;
                    var avatar = person.image.url;
                    var name = person.displayName;
                    $("#friends").append(html_person(id, avatar, name));
                }
            }
            $(".friend").click(function () {
                $(this).toggleClass("selected");
            });
            $(".friend").hover(function () {
                $(this).addClass("hovered");
            }, function () {
                $(this).removeClass("hovered");
            });
            $("#submit").click(function () {
                var selected = $(".selected");
                var result = "";
                for (i = 0; i < selected.length; i++)
                {
                    result += " g" + selected[i].id;
                }
                result = result.slice(1);
                $.post("/account/google/follow", { ids : result }, function (response) {
                    if (response.slice(0, 5) == "ERROR")
                    {
                        console.log(response);
                        alert("An error occured.");
                    }
                    else
                    {
                        window.location = "/lastpage";
                    }
                });
            });
        }
    });
});
html_person = function (id, avatar, name) {
    return "<tr class=\"spacer\"><td></td></tr><tr id=\"" + id + "\" class=\"friend pointing\"><td class=\"picture\"><img src=\"" + avatar + "\" /></td><td class=\"name\">" + name + "</td></tr><tr class=\"spacer\"><td></td></tr>";
};
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