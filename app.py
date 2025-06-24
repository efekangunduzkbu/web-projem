from flask import Flask, render_template, request, redirect, url_for, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user, login_required

app = Flask(__name__)
app.config['SECRET_KEY'] = 'bu-cok-gizli-bir-anahtar-olmalı'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login_page'

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login')
def login_page():
    if current_user.is_authenticated:
        return redirect(url_for('profile_page'))
    return render_template('login.html')

@app.route('/signup')
def signup_page():
    if current_user.is_authenticated:
        return redirect(url_for('profile_page'))
    return render_template('signup.html')

@app.route('/profile')
@login_required
def profile_page():
    return render_template('profile.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/api/signup', methods=['POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({'success': False, 'message': 'Bu kullanıcı adı zaten mevcut!'})
        
        new_user = User(username=username, password=password)
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({'success': True, 'redirect': url_for('login_page')})

@app.route('/api/login', methods=['POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        user = User.query.filter_by(username=username, password=password).first()
        
        if user:
            login_user(user)
            return jsonify({'success': True, 'redirect': url_for('profile_page')})
        else:
            return jsonify({'success': False, 'message': 'Geçersiz kullanıcı adı veya şifre!'})

if __name__ == '__main__':
    app.run(debug=True)