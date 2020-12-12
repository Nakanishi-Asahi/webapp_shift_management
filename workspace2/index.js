const express=require('express');

//req フォームからの入力を受け取れるようにする。
const bodyParser=require('body-parser');

//mysql mysqlとの接続に使う。
const mysql=require('mysql');
const connection=mysql.createConnection({
    host:'localhost',
    user:'mysql',
    password:'mysqlmysql',
    database:'db0',
    //文字コードにはutf8mb4を設定する。
    //これは入力に絵文字を使えるようにするため。
    charset : 'utf8mb4'
});
connection.connect((err)=>{
    if(err){
	console.log('error connecting: '+err.stack);
	return;
    }
    console.log('success');
});

//bcrypt パスワードのハッシュ化に使う。
const bcrypt=require('bcrypt');

//cookieのいろいろをできるようにする。
const cookieParser=require('cookie-parser')

const fs=require('fs');

const app=express();

//req
app.use(bodyParser.urlencoded({
    extended:true
}));

//cookie
app.use(cookieParser());

//viewエンジンをejsであることに設定
app.set("view engine","ejs");

//ホーム画面
app.get('/home',(req,res)=>{
    res.sendFile(__dirname+'/htmls/home.html');
})

//ログインを行う。
app.post('/login',(req,res)=>{
    connection.query(
	"select * from shift_users where email='"+req.body.email+"' and delete_flag=0;",
	(error,results)=>{
	    if(results.length==0){
		res.sendFile(__dirname+"/htmls/login_emailerr.html");
	    }
	    //tokenの生成を行う。
	    //ランダムな文字列10文字
	    //logoutedは特別扱いなのでtokenとしては使えない。
	    else if(results.length==1&&bcrypt.compareSync(req.body.password,results[0].hashed_password)){
		var l=10;
		var c="abcdefghijklmnopqrstuvwxyz0123456789";
		var cl=c.length;
		var token="";
		while(true){
		    for(var i=0;i<l;i++){
			//一様分布のランダムを使う。
			token+=c[Math.floor(Math.random()*cl)];
		    }
		    //logoutedはtokenには使用禁止なのでもう一度tokenを生成し直す。
		    if(token!="logouted"){
			break;
		    }
		}
		/*
		connection.query(
		    "insert into shift_users(token) values("+token+");",
		    (err,resu)=>{
		    }
		);
		*/
		connection.query(
		    "update shift_users set token='"+token+"' where id="+results[0].id+";",
		    (err,resu)=>{
		    }
		);
		res.cookie('token',token,{httpOnly:true});
		res.cookie('name_id',results[0].id,{httpOnly:true});
		res.redirect("/my_page");
	    }
	    else{
		res.sendFile(__dirname+"/htmls/login_passworderr.html");
	    }
	}
    );
});

//新規登録画面を送る。
app.get('/new',(req,res)=>{
    res.sendFile(__dirname+"/htmls/new.html");
});

//新規登録を行う。
app.post('/register',(req,res)=>{
    connection.query(
	"select * from shift_users where id="+req.cookies.name_id+" and token='"+req.cookies.token+"' and delete_flag=0 and admin_flag=1;",
	(error,results)=>{
	    if(results.length==1){
		connection.query(
		    "select * from shift_users where email='"+req.body.email+"' and delete_flag=0;",
		    (err,resu)=>{
			if(resu.length!=0){
			    res.sendFile(__dirname+'/htmls/register_emailerr.html');
			}
			else{
			    if(req.body.admin_cbx!="on"){
				connection.query(
				    "insert into shift_users(name,email,hashed_password) values('"+req.body.name+"','"+req.body.email+"','"+bcrypt.hashSync(req.body.password,10)+"');",
				    (era,riza)=>{
					console.log(era);
				    }
				);
				res.sendFile(__dirname+'/htmls/register_user_complete.html');
			    }
			    else{
				connection.query(
				    "insert into shift_users(name,email,hashed_password,admin_flag) values('"+req.body.name+"','"+req.body.email+"','"+bcrypt.hashSync(req.body.password,10)+"',1);",
				    (era,riza)=>{
				    }
				);
				res.sendFile(__dirname+'/htmls/register_admin_complete.html');
			    }
			}
		    }
		);
	    }
	    else{
		res.sendFile(__dirname+"/htmls/no_token.html");
	    }

	}
    );
});


app.get('/taikai',(req,res)=>{
    connection.query(
	"select * from shift_users where id="+req.cookies.name_id+" and token='"
+req.cookies.token+"' and delete_flag=0 and admin_flag=1;",
	(error,results)=>{
	    if(results.length==1){
		res.sendFile(__dirname+"/htmls/taikai.html");
	    }
	    else{
		res.sendFile(__dirname+"/htmls/no_token.html");
	    }
	}
    );
});

app.post('/withdrawal',(req,res)=>{
    //トークンをちゃんと持っているかどうか判定する。
    //また管理者権限を持っているかどうかも判定する。
    connection.query(
	"select * from shift_users where id="+req.cookies.name_id+" and token='"+req.cookies.token+"' and delete_flag=0 and admin_flag=1;",
	(error,results)=>{
	    if(results.length==1){
		console.log("ちゃんとトークンと管理者権限を持っているよ。");
		connection.query(
		    "select * from shift_users where email='"+req.body.email+"' and delete_flag=0;",
		    (err,resu)=>{
			if(resu.length==0){
			　　console.log("emailエラーだよ。");
			    res.sendFile(__dirname+"/htmls/withdrawal_emailerr.html");
			}
			else if(resu.length==1&&bcrypt.compareSync(req.body.password,resu[0].hashed_password)){
			    //削除しようとしているユーザが管理者だったら唯一の管理者かどうかを調べる
			    if(resu[0].admin_flag==1){
				console.log("唯一の管理者かどうか調べるよ。");
				connection.query(
				    "select * from shift_users where delete_flag=0 and admin_flag=1",
				    (era,riza)=>{
					if(riza.length==1){
					    res.sendFile(__dirname+"/htmls/withdrawal_admin1.html");
					}
					else{
					    connection.query(
						"update shift_users set delete_flag=1 where email='"+req.body.email+"';",
						(er,re)=>{
						    console.log("update chuu");
						    res.sendFile(__dirname+"/htmls/withdrawal_complete.html");
						}
					    );
					}
				    }
				);
			    }
			　　else{
				connection.query(
				   "update shift_users set delete_flag=1 where email='"+req.body.email+"';",
				   (era,riza)=>{
					res.sendFile(__dirname+"/htmls/withdrawal_complete.html");
				   }
				);
			    }
			}
			else{
			    res.sendFile(__dirname+"/htmls/withdrawal_passworderr.html");
			}
		    }
		);
	    }
	    else{
		res.sendFile(__dirname+"/htmls/no_token.html");
	    }
	}
    );
});
		

app.get('/my_page',(req,res)=>{
    connection.query(
	"select * from shift_users where id="+req.cookies.name_id+" and token='"+req.cookies.token+"' and delete_flag=0;",
	(error,results)=>{
	    if(results.length==1){
		const name=results[0].name;
		res.render("my_page",{message:name,admin_flag:results[0].admin_flag});
	    }
	    else{
		res.sendFile(__dirname+"/htmls/no_token.html");
	    }
	}
    );
})

/*
app.get('/admin_page',(req,res)=>{
    connection.query(
	"select * from shift_users where id="+req.cookies.name_id+" and token='"+req.cookies.token+"' and delete_flag=0 and admin_flag!=0;",
	(error,results)=>{
	    if(results.length==1){
		const name=results[0].name;
		res.render("landing_admin",{message: name});
	    }
	    else{
		res.sendFile(__dirname+"/htmls/no_token.html");
	    }
	}
    );
})
*/

app.get('/user_management',(req,res)=>{
    connection.query(
	"select * from shift_users where id="+req.cookies.name_id+" and token='"+req.cookies.token+"' and delete_flag=0;",
	(error,results)=>{
	    if(results.length==1){
		res.sendFile(__dirname+"/htmls/user_management.html");
	    }
	    else{
		res.sendFile(__dirname+"/htmls/no_token.html");
	    }
	}
    );
})

app.get('/show_all',(req,res)=>{
    connection.query(
	"select * from shift_users where id="+req.cookies.name_id+" and token='"+req.cookies.token+"' and delete_flag=0;",
	(error,results)=>{
	    if(results.length==1){
		connection.query(
		    "select * from shift_inputs;",
		    (err,resu)=>{
			if(resu.length==0){
			    res.render("no_such_input",{admin_flag:results[0].admin_flag});
			    /*
			    if(results[0].admin_flag==0){
				res.sendFile(__dirname+"/htmls/no_such_input_user.html");
			    }
			    else{
				res.sendFile(__dirname+"/htmls/no_such_input_admin.html");
			    }
			    */
			}
			else{
			    var entire_s="";
			    for(var i=0;i<resu.length;i++){
				var s=resu[i].id+","+resu[i].shift_date.toLocaleDateString()+","+resu[i].start_time+"~"+resu[i].end_time+","+resu[i].name;
				if(resu[i].comment!=""){
				    s+="@"+resu[i].comment;
				}
				if(resu[i].delete_flag!=0){
				    s+="//削除済み";
				}
				s+="<br>";
				entire_s+=s;
			    }
			    res.render("show",{message:entire_s,admin_flag:results[0].admin_flag});
			}
		    }
		);
	    }
	    else{
		res.sendFile(__dirname+"/htmls/no_token.html");
	    }
	}
    );
})


app.get('/sort_show',(req,res)=>{
    connection.query(
	"select * from shift_users where id="+req.cookies.name_id+" and token='"+req.cookies.token+"' and delete_flag=0;",
	(error,results)=>{
	    if(results.length==1){
		connection.query(
		    "select * from shift_inputs where delete_flag=0 order by shift_date asc;",
		    (err,resu)=>{
			if(resu.length==0){
			    res.render("no_such_input",{admin_flag:results[0].admin_flag});
			}
			else{
			    var entire_s="";
			    for(var i=0;i<resu.length;i++){
				var s=resu[i].shift_date.toLocaleDateString()+","+resu[i].start_time+"~"+resu[i].end_time+","+resu[i].name;
				if(resu[i].comment!=""){
				    s+="@"+resu[i].comment;
				}
				if(resu[i].delete_flag!=0){
				    s+="//削除済み"
				}
				s+="<br>";
				entire_s+=s;
			    }
			    res.render("show",{message:entire_s,admin_flag:results[0].admin_flag});
			}
		    }
		);
	    }
	    else{
		res.sendFile(__dirname+"/htmls/no_token.html");
	    }
	}
    );
});

app.post('/date_show',(req,res)=>{
    connection.query(
	"select * from shift_users where id="+req.cookies.name_id+" and token='"+req.cookies.token+"' and delete_flag=0;",
	(error,results)=>{
	    if(results.length==1){
		if(req.body.cb_date!="on"){
		    connection.query(
			"select * from shift_inputs where delete_flag=0 order by shift_date asc",
			(err,resu)=>{
			    if(resu.length==0){
				res.render("no_such_input",{admin_flag:results[0].admin_flag});
			    }
			    else{
				var entire_s="";
				var hash={};
				for(var i=0;i<resu.length;i++){
				    if(hash[resu[i].shift_date.toLocaleDateString()]){
					hash[resu[i].shift_date.toLocaleDateString()]+=","+resu[i].name;
				    }
				    else{
					hash[resu[i].shift_date.toLocaleDateString()]=resu[i].name;
				    }
				}
				keys=Object.keys(hash);
				for(var k of keys){
				    entire_s+=k+":"+hash[k]+"<br>";
				}
				res.render("show",{message:entire_s,admin_flag:results[0].admin_flag});
			    }
			}
		    );
		}
		else{
		    connection.query(
			"select * from shift_inputs where delete_flag=0 and datediff(shift_date,curdate())<7 and 0<=datediff(shift_date,curdate()) order by shift_date;",
			(err,resu)=>{
			    if(resu.length==0){
				res.render("no_such_input",{admin_flag:results[0].admin_flag});
			    }
			    else{
				var entire_s="";
				var hash={};
				for(var i=0;i<resu.length;i++){
				    if(hash[resu[i].shift_date.toLocaleDateString()]){
					hash[resu[i].shift_date.toLocaleDateString()]+=","+resu[i].name;
				    }
				    else{
					hash[resu[i].shift_date.toLocaleDateString()]=resu[i].name;
				    }
				}
				keys=Object.keys(hash);
				for(var k of keys){
				    entire_s+=k+":"+hash[k]+"<br>";
				}
				res.render("show",{message:entire_s,admin_flag:results[0].admin_flag});
			    }
			}	
		    );
		}
	    }
	    else{
		res.sendFile(__dirname+"/htmls/no_token.html");
	    }
	}
    );
});

app.get('/employee_show',(req,res)=>{
    connection.query(
	"select * from shift_users where id="+req.cookies.name_id+" and token='"+req.cookies.token+"' and delete_flag=0;",
	(error,results)=>{
	    if(results.length==1){
		connection.query(
		    "select * from shift_inputs where delete_flag=0 order by name asc",
		    (err,resu)=>{
			if(resu.length==0){
			    res.render("no_such_input",{admin_flag:results[0].admin_flag});
			}
			else{
			    var entire_s="";
			    var hash={};
			    for(var i=0;i<resu.length;i++){
				if(hash[resu[i].name]){
				    hash[resu[i].name]+=","+resu[i].shift_date.toLocaleDateString();
				}
				else{
				    hash[resu[i].name]=resu[i].shift_date.toLocaleDateString();
				}
			    }
			    keys=Object.keys(hash);
			    for(var k of keys){
				entire_s+=k+":"+hash[k]+"<br>";
			    }
			    res.render("show",{message:entire_s,admin_flag:results[0].admin_flag});
			}
		    }
		);
	    }
	    else{
		res.sendFile(__dirname+"/htmls/no_token.html");
	    }
	}
    );
});

app.post('/post_shift',(req,res)=>{
    console.log("select * from shift_users where id="+req.cookies.name_id+" and token='"+req.cookies.token+"' and delete_flag=0;");
    connection.query(
	"select * from shift_users where id="+req.cookies.name_id+" and token='"+req.cookies.token+"' and delete_flag=0;",
	(error,results)=>{
	    console.log(error);
	    if(results.length==1){
		connection.query(
		    "update shift_inputs set delete_flag=1 where shift_date='"+req.body.date1+"' and name_id="+req.cookies.name_id+";",
		    (err,resu)=>{
		    }
		);
		connection.query(
		    "insert into shift_inputs(shift_date,start_time,end_time,name_id,name,comment) select '"+req.body.date1+"','"+req.body.in_time+"','"+req.body.out_time+"',"+req.cookies.name_id+",name,'"+req.body.comment+"' from shift_users where id="+req.cookies.name_id+";",
		    (err,resu)=>{
			res.render("post_shift_complete",{admin_flag:results[0].admin_flag});
		    }
		);
	    }
	    else{
		res.sendFile(__dirname+"/htmls/no_token.html");
	    }
	}
    );
});

app.post('/delete_shift',(req,res)=>{
    connection.query(
	"select * from shift_users where id="+req.cookies.name_id+" and token='"+req.cookies.token+"' and delete_flag=0;",
	(error,results)=>{
	    if(results.length==1){
		connection.query(
		    "update shift_inputs set delete_flag=1 where shift_date='"+req.body.date2+"' and name_id="+req.cookies.name_id+";",
		    (error,results)=>{
		    }
		);
		res.render("delete_shift_complete",{admin_flag:results[0].admin_flag});
	    }
	    else{
		res.sendFile(__dirname+"/htmls/no_token.html");
	    }
	}
    );
    /*
    if(token_false(req.cookies.name_id,req.cookies.token)){
	res.send("問題が発生しました。ログインしなおしてください。");
    }
    else{
	connection.query(
	    "update shift_inputs set delete_flag=1 where shift_date='"+req.body.date2+"' and name_id="+req.cookies.name_id+";",
	    (error,results)=>{
	    }
	);
	res.send("シフトを削除したよ！");
    }
    */
});

app.get('/logout',(req,res)=>{
    connection.query(
	"select * from shift_users where id="+req.cookies.name_id+" and token='"+req.cookies.token+"' and delete_flag=0;",
	(error,results)=>{
	    if(results.length==1){
		connection.query(
		    "update shift_users set token='logouted' where id="+req.cookies.name_id+";",
		    (err,resu)=>{
			res.redirect("/home");
		    }
		);
	    }
	    else{
		res.sendFile(__dirname+"/htmls/no_token.html");
	    }
	}
    );
    /*
    connection.query(
	"select * from shift_users where id="+req.cookies.name_id+";",
	(error,results)=>{
	    if(results[0].token==req.cookies.token){
		connection.query(
		    "update shift_users set token='logouted' where id="+req.cookies.name_id+";",
		    (err,resu)=>{
		    }
		);
		res.redirect("/");
	    }
	    else{
		res.send("問題が発生しました。ログインしなおしてください。")
	    }
	}
    );
    */
});

app.listen(5000,()=>console.log('Listening on port 5000'));
